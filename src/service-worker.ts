import db, { IEmoticon } from './database';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

async function downloadResource(url:string) {
  if (!url) return null;

  try{
    const res = await fetch(url);
    const type = res.headers.get('Content-Type') || '';

    if (!type.startsWith('image/') && !type.startsWith('video/'))
      throw new Error(`Unsupported type: ${type}`);

    const b = await res.blob();
    return b;
  } catch(error) {
    console.error('url:', url);
    console.error('Error downloading resource:', error);
    return null; // 또는 에러 처리에 따라 다른 값 반환
  }
}

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
          sendResponse({ status: 'ok', message: '태그를 저장했습니다.' });
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
        {
          const { enabled, disabled, expired } = msg.data;
          await chrome.storage.local.set(
            {
              arcacon_enabled: enabled,
              arcacon_disabled: disabled,
              arcacon_expired: expired
            });
          sendResponse({ status: 'ok' });
        }
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

        const headerEmoticon = await db.base_emoticon.where('packageId').equals(pId).toArray();
        console.log(headerEmoticon);
        sendResponse({ status: 'ok', data: result });
        break;

      // case 'getAllHeadIcons':
      //   {
      //     const headerIcons = await db.base_emoticon.toArray();
      //     sendResponse({ status: 'ok', data: headerIcons });
      //   }
      //   break;

      case 'resourceCollect':
        {
          const { data: els } = msg;
          const downloadQueue = els.map(async (el:any) => ({
            conId: el.conId,
            packageId: el.packageId,
            conOrder: el.conOrder,
            image: await downloadResource(el.image),
            video: await downloadResource(el.video),
          }));
          try{
            const downloaded = await Promise.all(downloadQueue);
            await db.emoticon.bulkPut(downloaded);
            sendResponse({ status: 'ok' });
          } catch(e) {
            sendResponse({ status: 'error', message: e.message });
          }
          break;
        };

      case 'saveHeadArcacons':
        try{
          const headCons = msg.data;
          const r = headCons.map(async (el:any) => {
            return {
              packageId: el.packageId,
              src: await downloadResource(el.url),
            }
          });
          const downloaed = await Promise.all(r);
          await db.base_emoticon.bulkPut(downloaed);
          sendResponse({ status: 'ok' });
        } catch(e){
          console.error(e);
          sendResponse({ status: 'error', message: e.message });
        }
        break;
      }
    })();
  return true;
});