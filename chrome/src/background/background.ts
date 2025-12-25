import db, { IEmoticon, IPackageInfo } from '../database';
import { downloadResource } from '../util/download';
import { fuse, indexing, updateIndex } from './searchBackend';
import type { Setting, ArcaconPackage } from '../type/storage';
 

// 백그라운드 onMessage 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const data: any = msg.data;
  const packageId: number = msg.packageId;
  (async () => {
    switch (msg.action) {
      case 'updateTags':
        const updateIDs = Object.keys(data).map(Number);
        const updateCons = await db.emoticon.bulkGet(updateIDs);
        if(!updateCons[0]){
          sendResponse({ status: 'ok', message: '아카콘을 먼저 다운받아 주세요.' });
          break;
        }
        const newTags = updateCons.map(item => Object.assign(item, data[item.conId]));

        const packageHaad = await db.package_info.get(packageId) || {};
        const newHeadTags = Object.assign(packageHaad, { packageId: packageId, tags: msg.head });
        try {
          await db.emoticon.bulkPut(newTags);
          await db.package_info.put(newHeadTags);
        } catch (error) {
          console.error('background updateTags:', error);
          sendResponse({ status: 'error', message: error.message });
        }
        // 단방향 메시지라 같은 리스너엔 불가
        try {
          await updateIndex();
          await indexing();
          sendResponse({ status: 'ok', message: '태그를 저장했습니다.' });
        } catch (error) {
          console.error('background indexUpdate:', error);
          sendResponse({ status: 'error', message: error.message });
        }
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

      // 태그데이터 요청
      case 'getTags':
        const pId: number = Number(data);
        console.log(pId, '태그 로드중');
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
        console.log(pId, '태그 헤더데이터', headerTags);

        sendResponse({ status: 'ok', data: result, head: headerTags || [] });
        break;

      case 'resourceCollect':
        // 헤드 이미지, 패키지 이름
        // 패키지, 헤드 데이터를 갱신
        const { head } = msg;
        chrome.storage.local.get('arcacon_package')
        .then(r => {
          const loc = r.arcacon_package as ArcaconPackage;
          const target = Object.assign(loc[head.packageId], 
            {
              available: true,
              title:head.title, 
              packageName:head.title,
              visible: true,
            }
          );
          loc[head.packageId] = target;
          chrome.storage.local.set({ arcacon_package: loc });
        });
        
        const downloadQueue = data.map(async (el: any) => ({
          conId: el.conId,
          packageId: packageId,
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

      case 'search':
        if (fuse === null) {
          sendResponse({ status: 'ok', message: '인덱싱중입니다' });
        } else {
          const conIds: number[] = [];
          let searchResult = fuse.search(data.map((e:string)=>`'${e}`).join(' '));
          searchResult.forEach((dict) => {
            conIds.push(dict.item.conId);
          });
          sendResponse({ status: 'ok', data: conIds });
        }
        break;

      case 'advencedSearch':
        if (fuse === null) {
          sendResponse({ status: 'ok', message: '인덱싱중입니다' });
        } else {
          const conIds: number[] = [];
          let searchResult = fuse.search(data);
          searchResult.forEach((dict) => {
            conIds.push(dict.item.conId);
          });
          sendResponse({ status: 'ok', data: conIds });
        }
        break;

      case 'indexUpdate':
        try {
          await updateIndex();
          await indexing();
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
    id: 'arcaconSetting',
    title: '아카콘 설정',
    contexts: ['action'],
    enabled: false,
  });

  interface Setting {
    isSleep?: boolean;
    sleepTime?: number;
    conSize?: number;
    sleepOpacity?: number;
    syncSearch?: boolean;
    syncSetting?: boolean;
    syncArcacons?: boolean;
  }
  // 설정 기본값
  chrome.storage.local.get('arcacon_setting').then((res) => {
    let setting: Setting = res.arcacon_setting || {};

    chrome.storage.sync.get('arcacon_setting').then((res) => {
      let syncSetting: Setting = res.arcacon_setting || {};

      if(Object.keys(syncSetting).length > 0){
        setting = syncSetting;
      } else {
        if (!('isSleep' in setting)) setting.isSleep = true;
        if (!('sleepTime' in setting)) setting.sleepTime = 3000;
        if (!('conSize' in setting)) setting.conSize = 50; // px
        if (!('sleepOpacity' in setting)) setting.sleepOpacity = 0.9;
        if (!('syncSearch' in setting)) setting.syncSearch = true;
        if (!('syncSetting' in setting)) setting.syncSetting = true;
        if (!('syncArcacons' in setting)) setting.syncArcacons = true;
      }

      chrome.storage.local.set({ arcacon_setting: setting });
    });
  });

  chrome.storage.sync.get(['arcacon_package', 'arcacon_enabled']).then((res) => {
    if(res.arcacon_package) chrome.storage.local.set({arcacon_package:res.arcacon_package});
    if(res.arcacon_enabled) chrome.storage.local.set({arcacon_enabled:res.arcacon_enabled});
  });

  // 최초설치 및 버전 변경시 릴리즈노트 표시
  chrome.storage.local.set({ release: true });
});

// background.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel-connection') {
    chrome.contextMenus.update('popupSetting', {
      title: '팝업창설정',
      enabled: true,
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
      chrome.contextMenus.update('popupSetting', {
        title: '팝업창설정-패널을 열어주세요',
        enabled: false,
      });
    });
  }
});

// 컨텍스트 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // 팝업창설정, 아카콘설정
  if (info.menuItemId === 'popupSetting') chrome.runtime.sendMessage({ action: 'popupSettingMessage' });
  if (info.menuItemId === 'arcaconSetting') chrome.runtime.sendMessage({ action: 'arcaconSettingMessage' });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    chrome.storage.local.get('arcacon_setting')
      .then((data) => {
        interface Setting {
          syncSetting?: boolean;
          syncArcacons?: boolean;
        }
        // 초기에는 비동기로 값을 초기화해 없음
        const setting: Setting = data.arcacon_setting || {syncSetting: true, syncArcacons: true};

        interface SyncRules {
          [key: string]: boolean | undefined;
          arcacon_setting: boolean | undefined;
          arcacon_package: boolean | undefined;
          arcacon_enabled: boolean | undefined;
        }
        const syncRules:SyncRules = {
          // 변경된 데이터가 들어오면: 키에대한 설정값을 사용합니다.
          arcacon_setting: setting.syncSetting,
          arcacon_package: setting.syncArcacons,
          arcacon_enabled: setting.syncArcacons,
        };

        const payload:any = {};

        // changes 순회
        for (const key of Object.keys(changes)) {
          if (syncRules[key]) payload[key] = changes[key].newValue;
        }

        if (Object.keys(payload).length) chrome.storage.sync.set(payload);

      });
  }
});