import db, { IEmoticon, IPackageInfo } from '../database';
import { downloadResource } from '../util/download';
import './searchBackend';

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 백그라운드 onMessage 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const data: any = msg.data;
  (async () => {
    switch (msg.action) {
      case 'updateTags':
        const pid = data[0].packageId;
        const updates = data.map((item: IEmoticon) => ({
          key: item.conId,
          changes: {
            tags: item.tags,
            chosung: item.chosung,
          },
        }));
        console.log(updates);
        try {
          await db.emoticon.bulkUpdate(updates);
          await db.package_info.update(pid, { tags: msg.head });
          sendResponse({ status: 'ok', message: '태그를 저장했습니다.' });

        } catch (error) {
          console.error('background updateTags:', error);
          sendResponse({ status: 'error', message: error.message });
        }
        chrome.runtime.sendMessage({action: 'indexUpdate' });
        break;

      // 패키지 조회
      case 'getConPackage':
        const query: IEmoticon[] = await db.emoticon
          .where('packageId')
          .equals(msg.packageId)
          .sortBy('conOrder');
        sendResponse({ status: 'ok', data: query });
        break;

      // 리소스 저장 요청을 처리합니다.
      case 'saveResources':
        const resources: IEmoticon[] = data;
        await db.emoticon.bulkPut(resources);
        sendResponse({ status: 'ok' });
        break;

      case 'orderUpdated':
        {
          const { enabled, disabled, expired } = data;
          await chrome.storage.local.set({
            arcacon_enabled: enabled,
            arcacon_disabled: disabled,
            arcacon_expired: expired,
          });
          sendResponse({ status: 'ok' });
        }
        break;

      // 태그데이터 요청
      case 'getTags':
        const pId: number = Number(data);
        console.log(pId);
        const emoticons: IEmoticon[] = await db.emoticon
          .where('packageId')
          .equals(pId)
          .toArray();
        const tags: { [key: number]: string[] } = {};
        emoticons.forEach((emoticon: IEmoticon) => {
          if ('tags' in emoticon) {
            tags[emoticon.conId] = emoticon.tags;
          }
        });
        const result: { [key: number]: { [key: number]: string[] } } = {};
        result[pId] = tags;

        const headerTags = await db.package_info.get(pId);

        sendResponse({ status: 'ok', data: result, head: headerTags });
        break;

      case 'resourceCollect': {
        const { data: els } = msg;
        const downloadQueue = els.map(async (el: any) => ({
          conId: el.conId,
          packageId: el.packageId,
          conOrder: el.conOrder,
          image: await downloadResource(el.image),
          video: await downloadResource(el.video),
        }));
        try {
          const downloaded = await Promise.all(downloadQueue);
          await db.emoticon.bulkPut(downloaded);
          sendResponse({ status: 'ok' });
        } catch (e) {
          sendResponse({ status: 'error', message: e.message });
        }
        break;
      }

      case 'saveHeadArcacons':
        try {
          const headCons = data;
          const r = headCons.map(async (el: any) => {
            return {
              packageId: el.packageId,
              src: await downloadResource(el.url),
            };
          });
          const downloaed = await Promise.all(r);
          await db.base_emoticon.bulkPut(downloaed);
          sendResponse({ status: 'ok' });
        } catch (e) {
          console.error(e);
          sendResponse({ status: 'error', message: e.message });
        }
        break;
    }
  })();
  return true;
});

// 확장 프로그램이 처음 설치되거나, 업데이트되거나, 크롬이 업데이트될 때 실행됩니다.
chrome.runtime.onInstalled.addListener(() => {
  // 컨텍스트 메뉴 항목을 생성합니다.
  chrome.contextMenus.create({
    id: 'popupSetting', // 메뉴 항목의 고유 ID
    title: '팝업창 설정', // 메뉴에 표시될 텍스트
    contexts: ['action'], // 'action'은 확장 프로그램 아이콘의 우클릭 메뉴를 의미합니다.
    enabled: false,
  });
  chrome.contextMenus.create({
    id: 'arcaconSetting', // 메뉴 항목의 고유 ID
    title: '아카콘 설정', // 메뉴에 표시될 텍스트
    contexts: ['action'], // 'action'은 확장 프로그램 아이콘의 우클릭 메뉴를 의미합니다.
    enabled: false,
  });

  interface Setting {
    isSleep?: boolean;
    sleepTime?: string;
    conSize?: string;
    sleepOpacity?: string;
    syncSearch?: boolean;
  }
  // 설정 기본값
  chrome.storage.local.get('arcacon_setting').then((res) => {
    let setting: Setting = res.arcacon_setting || {};

    if (!('isSleep' in setting)) setting.isSleep = true;
    if (!('sleepTime' in setting)) setting.sleepTime = '3000';
    if (!('conSize' in setting)) setting.conSize = '50';
    if (!('sleepOpacity' in setting)) setting.sleepOpacity = '50';
    if (!('syncSearch' in setting)) setting.syncSearch = true;

    chrome.storage.local.set({ arcacon_setting: setting });
  });
});

// background.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel-connection') {
    chrome.contextMenus.update('popupSetting', {
      title: '팝업창설정',
      enabled: true,
    });

    port.onDisconnect.addListener(() => {
      chrome.contextMenus.update('popupSetting', {
        title: '팝업창설정-패널을 열어주세요',
        enabled: false,
      });
    });

    chrome.contextMenus.update('arcaconSetting', {
      title: '아카콘설정',
      enabled: true,
    });

    port.onDisconnect.addListener(() => {
      chrome.contextMenus.update('arcaconSetting', {
        title: '아카콘설정-패널을 열어주세요',
        enabled: false,
      });
    });
  }
});

// 컨텍스트 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // 클릭된 메뉴의 ID가 "popupSetting"인지 확인합니다.
  if (info.menuItemId === 'popupSetting') {
    // 팝업(사이드 패널)에 메시지를 보내 설정 다이얼로그를 열도록 합니다.
    chrome.runtime.sendMessage({ action: 'popupSettingMessage' });
  }
  if (info.menuItemId === 'arcaconSetting') {
    // 팝업(사이드 패널)에 메시지를 보내 설정 다이얼로그를 열도록 합니다.
    chrome.runtime.sendMessage({ action: 'arcaconSettingMessage' });
  }
});
