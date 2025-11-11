import Dexie, { type EntityTable } from 'dexie';

interface IEmoticon {
  packageId: number;
  conId: number;
  conOrder?: number;
  tags?: string[];
  image?: string;
  video?: string;
}

class ArcaconDB extends Dexie {
  emoticon!: Dexie.Table<IEmoticon, number>; // 기본 키는 'conId' (number)

  constructor() {
    super('Arcacons');
    this.version(1).stores({
      // 기본키는 conId, packageId와 tags는 인덱싱합니다.
      emoticon: 'conId, packageId, *tags',
    });
  }
}

const db = new ArcaconDB();

// const db = new Dexie('Arcacons') as Dexie & {
//   emoticon: EntityTable<IEmoticon, 'conId'>;
//   // (The 4.x EntityTable<T> can make a the primary key optional on
//   // add/bulkAdd operations)
// };

// db.version(1).stores({
//   emoticon: `
//   conId,
//   packageId,
//   conOrder,
//   *tags
//   `
//   // &[packageId+conId], 
//   // [packageId+conOrder], 
//   // *tags`
// });


chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// onMessage 리스너 자체는 async로 만들지 않습니다.
// 이렇게 해야 리스너가 즉시 `true`를 반환하여 메시지 채널을 열어둘 수 있습니다.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.action) {
      case 'updateTags':
        try {
          const data: IEmoticon[] = msg.data;
          const updates = data.map((item:IEmoticon) => ({
            key: item.conId,
            changes: { 
              tags: item.tags,
            }
          }));
          console.log(updates);
          await db.emoticon.bulkUpdate(updates);
          sendResponse({ status: 'ok', message: '태그를 성공적으로 저장했습니다.' });
        } catch (error) {
          console.error('Service Worker: Error updating tags:', error);
          sendResponse({ status: 'error', message: error.message });
        }
        break;

      // 패키지 조회
      case 'getConPackage':
        const packageId = msg.packageId;
        const query: IEmoticon[] = await db.emoticon.where('packageId').equals(packageId).sortBy('conOrder');
        sendResponse({ status: 'ok', data: query });
        break;

      // 리소스 저장 요청을 처리합니다.
      case 'saveResources':
        const resources: IEmoticon[] = msg.data;
        await db.emoticon.bulkPut(resources);
        sendResponse({ status: 'ok' });
        break;

      case 'orderUpdated':
        const { enabled, disabled, expired } = msg.data;
        await chrome.storage.local.set(
          {
            arcacon_enabled: enabled, 
            arcacon_disabled: disabled, 
            arcacon_expired: expired 
          });
        sendResponse({ status: 'ok' });
        break;

      // 판매 페이지에서 아카콘 이미지데이터 저장
      case 'resourceCollect':
        const els = msg.data;
        await db.emoticon.bulkPut(els);
        sendResponse({ status: 'ok' });
        break;

      // 태그데이터 요청
      case 'getTags':
        const pId: number = Number(msg.data);
        console.log(pId);
        const emoticons: IEmoticon[] = await db.emoticon.where('packageId').equals(pId).toArray();
        const tags: { [key: number]: string[] } = {};
        emoticons.forEach((emoticon:IEmoticon) => {
          if ('tags' in emoticon){
            tags[emoticon.conId] = emoticon.tags;
          }
        });
        const result: { [key: number]: { [key: number]: string[] } } = {};
        result[pId] = tags;
        sendResponse({ status: 'ok', data: result });
        break;
      }
    })();
  return true;
});