import db, { IEmoticon } from '../database';
import Fuse from 'fuse.js';

// 인덱스데이터 유지를 위해 백그라운드에서 실행
export let fuse: Fuse<any> | null = null;
indexing();

export async function updateIndex() {
  let index = { id:1, data: {} };
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
    if (appSetting.syncSearch && !packageList[pID].visible) return;
    if (!heads[pID] && !emoticon.tags) return;
    return {
      conId: emoticon.conId,
      tags: emoticon.tags,
      chosung: emoticon.chosung,
      packageTags: heads[emoticon.packageId],
    };
  });
  index.data = Fuse.createIndex(fuseOption.keys, emoticonMapped).toJSON();
  await db.search_index.put(index, 1);
  return index.data;
}

// 데이터 유지를 위해 백그라운에서 진행
export async function indexing() {
  const emoticons = await db.emoticon.toArray();
  const fuseOption = {
    keys: ['tags', 'chosung', 'packageTags'],
    threshold: 0,
    useExtendedSearch: true,
  };
  // TODO 초기값 설정하는 코드 작성
  let savedIndex = (await db.search_index.get(1)) || {};
  if (!savedIndex || !savedIndex.data) savedIndex.data = await updateIndex();
  let index = Fuse.parseIndex(savedIndex.data);
  
  fuse = new Fuse(emoticons, fuseOption, index);
}