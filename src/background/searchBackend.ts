import db from '../database';
import Fuse from 'fuse.js';

interface searchEntry{
  conId: number;
  tags: string[];
  chosung: string[];
  packageTags: string[];
}

// 인덱스데이터 유지를 위해 백그라운드에서 실행
export let fuse: Fuse<any> | null = null;
indexing();

export async function updateIndex() {
  const fuseOption = {
    keys: ['tags', 'chosung', 'packageTags'],
    threshold: 0,
    useExtendedSearch: true,
  };
  const packagesData = await db.package_info.toArray();
  const heads: { [key: number]: string[] } = {};
  for (const head of packagesData) {
    heads[head.packageId] = head.tags;
  }
  
  const appSetting = (await chrome.storage.local.get('arcacon_setting')).arcacon_setting ?? [];
  const packageList = (await chrome.storage.local.get('arcacon_package')).arcacon_package ?? [];
  
  const emoticons = await db.emoticon.toArray();
  const indexMap: searchEntry[] = [];
  emoticons.forEach((emoticon) => {
    const pID = emoticon.packageId;
    if (appSetting.syncSearch && !packageList[pID].visible) return;
    if (!heads[pID] && !emoticon.tags) return;

    indexMap.push({
      conId: emoticon.conId,
      tags: emoticon.tags,
      chosung: emoticon.chosung,
      packageTags: heads[emoticon.packageId],
    });

  });
  // const emoticonMapped: IEmoticon[] = emoticons.map((emoticon) => {
  //   const pID = emoticon.packageId;
  //   if (appSetting.syncSearch && !packageList[pID].visible) return;
  //   if (!heads[pID] && !emoticon.tags) return;
  //   return {
  //     conId: emoticon.conId,
  //     tags: emoticon.tags,
  //     chosung: emoticon.chosung,
  //     packageTags: heads[emoticon.packageId],
  //   };
  // });
  
  // let index = { id:1, data: {} };
  const index = Fuse.createIndex(fuseOption.keys, indexMap).toJSON();
  await db.search_index.put({ id: 1, data: index });
  return index;
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