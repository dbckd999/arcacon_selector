import db, { IEmoticon, IPackageInfo } from '../database';
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
          const { data } = msg;
          let searchResult = fuse.search(data.join(' '));
          const conIds: number[] = [];
          searchResult.forEach((dict) => {
            conIds.push(dict.item.conId);
          });
          sendResponse({ status: 'ok', data: conIds });
        }
        break;
    }
  })();
  return true;
});

// 데이터 유지를 위해 백그라운에서 진행
async function indexing() {
  const fuseOption = {
    keys: ['tags', 'chosung', 'packageTags'],
    threshold: 0,
    useExtendedSearch: true,
  };
  const updated = await chrome.storage.local.get('indexUpdating');
  let index = null;
  const emoticons = await db.emoticon.toArray();

  if (!updated.indexUpdating) {
    // 저장된 인덱스가 없다면 db쿼리
    const packagesData = await db.package_info.toArray();
    const b: { [key: number]: string[] } = {};
    for (const head of packagesData) {
      b[head.packageId] = head.tags;
    }
    const emoticonMapped: IEmoticon[] = emoticons.map((emoticon) => {
      if (emoticon.conId || emoticon.tags || b[emoticon.packageId].length === 0)
        return;
      return {
        conId: emoticon.conId,
        tags: emoticon.tags,
        chosung: emoticon.chosung,
        packageTags: b[emoticon.packageId],
      };
    });

    index = Fuse.createIndex(fuseOption.keys, emoticonMapped);
    db.search_index.put(index.toJSON(), 1);
  } else {
    // 필요없으면 기존 데이터 불러오기
    const query = await db.search_index.get(1);
    index = Fuse.parseIndex(query);
  }

  return new Fuse(emoticons, fuseOption, index);
}
