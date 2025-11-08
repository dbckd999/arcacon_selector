import Dexie from 'dexie';

// 데이터베이스 테이블의 타입을 정의합니다. (search.ts와 일치시킵니다)
interface IEmoticon {
  packageId: number;
  conId: number;
  conOrder?: number;
  tags?: string[];
  image?: string;
  video?: string;
}

// Dexie 인스턴스에 테이블의 타입을 알려줍니다.
class ArcaconDB extends Dexie {
  emoticon!: Dexie.Table<IEmoticon, [number, number]>; // 복합 기본 키 [packageId, conId]의 타입

  constructor() {
    super('Arcacons');
    this.version(1).stores({
      emoticon: '&[packageId+conId], [packageId+conOrder], *tags',
    });
  }
}

const db = new ArcaconDB();

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
          console.log(msg.data);
          const data: IEmoticon[] = msg.data;
          await db.emoticon.bulkPut(data);
          sendResponse({ status: 'ok' });
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
        console.log(Number(msg.data));
        const tags = await db.emoticon.where('packageId').equals(Number(msg.data)).toArray();
        sendResponse({ status: 'ok', data: tags });
        break;
      }
    })();
  return true;
});