import { notify } from './notify';

// popup.js의 설정들
const settingGround = document.querySelectorAll('#setting [data-setting]');
settingGround.forEach(el => el.addEventListener('sl-change', setSetting));

// 설정값 입력
let setting:{ [key: string]: string } = {};
chrome.storage.local.get('arcacon_setting').then(res => {
    setting = res['arcacon_setting'] || {};

    Object.keys(setting).forEach(key => {
        if(key){
            const targetElement = document.querySelector(`#setting [data-setting=${key}]`);
            if (targetElement.tagName === 'SL-SWITCH' && setting[key] === 'true') {
                targetElement.setAttribute('checked', '');
            }
            else {
                targetElement.setAttribute('value', setting[key]);
            }
        }
    });
});

// 설정값들 setting객체에 저장
function setSetting(event:Event) {
    const element = event.target as HTMLInputElement;
    console.log(element);
    
    const key:string = element.getAttribute('data-setting');
    let value:string = element.value;
    if(element.tagName === "SL-SWITCH"){
        const is = !element.hasAttribute('checked');
        value = String(is);
    }
    setting[key] = value;
    chrome.storage.local.set({ 'arcacon_setting':setting });

    // 재시작 알림
    notify('설정반영을 위해 다시 열어주세요.');
}