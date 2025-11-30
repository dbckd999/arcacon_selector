import db, { IEmoticon } from '../database';
import Fuse from 'fuse.js';

// 인덱스데이터 유지를 위해 백그라운드에서 실행
let fuse: Fuse<any> | null = null;
indexing().then((f) => (fuse = f));

// 백그라운드 onMessage 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const data: any = msg.data;
  (async () => {
    switch (msg.action) {
      case 'search':
        if (fuse === null) {
          sendResponse({ status: 'ok', message: '인덱싱중입니다' });
        } else {
          let searchResult = fuse.search(data.join(' '));
          const conIds: number[] = [];
          searchResult.forEach((dict) => {
            conIds.push(dict.item.conId);
          });
          sendResponse({ status: 'ok', data: conIds });
        }
        break;
      case 'indexUpdate':
        try{
          await updateIndex();
          fuse = await indexing();
          sendResponse({ status: 'ok' });
        } catch (error) {
          console.error('background indexUpdate:', error);
          sendResponse({ status: 'error', message: error.message });
        }
        
        break;
    }
  })();
  return true;
});

async function updateIndex() {
  let index = null;
  const fuseOption = {
    keys: ['tags', 'chosung', 'packageTags'],
    threshold: 0,
    useExtendedSearch: true,
  };
  const emoticons = await db.emoticon.toArray();
  const packagesData = await db.package_info.toArray();
  const heads: { [key: number]: string[] } = {};
  for (const head of packagesData) {
    heads[head.packageId] = head.tags;
  }

  const appSetting = (await chrome.storage.local.get('arcacon_setting')).arcacon_setting ?? [];
  const packageList = (await chrome.storage.local.get('arcacon_package')).arcacon_package ?? [];
  const emoticonMapped: IEmoticon[] = emoticons.map((emoticon) => {
    const pID = emoticon.packageId;
    // 연동유무
    if (appSetting.syncSearch && !packageList[pID].visible) return;
    // 태그 유무
    if (!heads[pID] && !emoticon.tags) return;
    return {
      conId: emoticon.conId,
      tags: emoticon.tags,
      chosung: emoticon.chosung,
      packageTags: heads[emoticon.packageId],
    };
  });
  index = Fuse.createIndex(fuseOption.keys, emoticonMapped).toJSON();
  db.search_index.put(index, 1);
  return index;
}

// 데이터 유지를 위해 백그라운에서 진행
async function indexing() {
  const emoticons = await db.emoticon.toArray();
  const fuseOption = {
    keys: ['tags', 'chosung', 'packageTags'],
    threshold: 0,
    useExtendedSearch: true,
  };
  let savedIndex = await db.search_index.get(1);
  if (!savedIndex) savedIndex = await updateIndex();
  let index = Fuse.parseIndex(savedIndex);
  
  return new Fuse(emoticons, fuseOption, index);
}