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
let setting: { [key: string]: string|boolean } = {};
browser.storage.local.get('arcacon_setting').then((res) => {
  setting = res['arcacon_setting'] || {};

  if (setting.isSleep) document.querySelector('#setting [data-setting=isSleep]')
    .setAttribute('checked', 'true');
  document.querySelector('#setting [data-setting=sleepTime]')
    .setAttribute('value', setting.sleepTime as string);
  document.querySelector('#setting [data-setting=conSize]')
    .setAttribute('value', setting.conSize as string);
  document.querySelector('#setting [data-setting=sleepOpacity]')
    .setAttribute('value', setting.sleepOpacity as string);
  document.querySelector('#is-show [name=syncSearch]')
    .setAttribute('checked', setting.syncSearch as string);
});

// 설정값들 setting객체에 저장
function setSetting(event: Event) {
  const element = event.target as HTMLInputElement;
  console.log('설정할 엘리먼트', element);

  const key: string = element.getAttribute('data-setting');
  let value: string|boolean = element.value;
  if (element.tagName === 'SL-SWITCH') {
    const is = !element.hasAttribute('checked');
    value = is;
  }
  setting[key] = value;
  browser.storage.local.set({ arcacon_setting: setting });

  // 재시작 알림
  notify('설정반영을 위해 다시 열어주세요.');
}
