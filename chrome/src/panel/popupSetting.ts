import { notify } from '../util/notify';

// popup.js의 설정들
const settingGround = document.querySelectorAll('#setting [data-setting]');
settingGround.forEach((el) => el.addEventListener('sl-change', setSetting));

// 설정값 입력
/*
interface Setting {
  isSleep?: boolean;
  sleepTime?: string;
  conSize?: string;
  sleepOpacity?: string;
  syncSearch?: boolean;
}
*/
let setting: { [key: string]: string | boolean } = {};
chrome.storage.local.get('arcacon_setting').then((res) => {
  setting = res['arcacon_setting'] || {};
  // 각 엘리먼트에 설정값 입력
  (
    document.querySelector(
      '#setting [data-setting=isSleep]'
    ) as HTMLInputElement
  ).checked = setting.isSleep as boolean;
  document
    .querySelector('#setting [data-setting=sleepTime]')
    .setAttribute('value', setting.sleepTime.toString());
  document
    .querySelector('#setting [data-setting=conSize]')
    .setAttribute('value', setting.conSize.toString());
  document
    .querySelector('#setting [data-setting=sleepOpacity]')
    .setAttribute('value', setting.sleepOpacity.toString());
  (
    document.querySelector('#is-show [name=syncSearch]') as HTMLInputElement
  ).checked = setting.syncSearch as boolean;
  (
    document.querySelector(
      '#setting [data-setting=syncSetting]'
    ) as HTMLInputElement
  ).checked = setting.syncSetting as boolean;
  (
    document.querySelector(
      '#setting [data-setting=syncArcacons]'
    ) as HTMLInputElement
  ).checked = setting.syncArcacons as boolean;
});

// 설정값들 setting객체에 저장
function setSetting(event: Event) {
  const element = event.target as HTMLInputElement;
  console.log('설정할 엘리먼트', element);

  const key: string = element.getAttribute('data-setting');
  let value: string | boolean = element.value;
  switch (key) {
    case 'isSleep':
    case 'syncSetting':
    case 'syncArcacons':
      value = !element.hasAttribute('checked');
      break;
    case 'sleepTime':
    case 'conSize':
    case 'sleepOpacity':
    case 'syncSearch':
    case 'sleepTime':
      value = element.value;
      break;
  }

  setting[key] = value;
  chrome.storage.local
    .set({ arcacon_setting: setting })
    // 재시작 알림
    .then(() => notify('설정반영을 위해 다시 열어주세요.'));
}
