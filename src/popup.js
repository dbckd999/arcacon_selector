'use strict';

import './popup.css';
import { createBase, notify } from './notify.ts';

createBase();

// 저장된 콘 패키지 목록 순회
const { arcacon_package: packageList } = await chrome.storage.local.get('arcacon_package');
const { arcacon_enabled: customSort } = await chrome.storage.local.get('arcacon_enabled');
let conPackage = [];
let comboState = false;

async function sendActivity(action, data = {}) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: action,
    data: data,
  });
  return response;
}

function addCombocon(groupId, conId, thumbnail) {
  if (conPackage.length >= 3) {
    conPackage.shift();
    document.querySelector('div#comboConWrap *').remove();
  }
  conPackage.push([groupId, conId]);
  document.getElementById('comboConWrap').append(thumbnail);
}

async function downloadAndBase64(url) {
  if (url === null) {
    return null;
  }
  const res = await fetch('https:' + url);
  const b = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(b);
  });
}

async function showConPackage(packageId, pakcageName) {
  packageId = Number(packageId);
  const ground = document.getElementById('conWrap');
  const _thumbnail_wrapper = document.querySelector(
    `.package-wrap[data-package-id="${packageId}"]`
  );
  if (_thumbnail_wrapper) {
    _thumbnail_wrapper.remove();
  }
  if (customSort && customSort.indexOf(packageId) === -1) return;

  // 입력할 칸만 미리 만들어놓고 db관련은 비동기로 진행
  const thumbnail_wrapper = document.createElement('div');
  thumbnail_wrapper.setAttribute('class', 'package-wrap');
  thumbnail_wrapper.setAttribute('data-package-id', packageId);

  const title = document.createElement('span');
  title.textContent = pakcageName;
  thumbnail_wrapper.append(title);
  thumbnail_wrapper.append(document.createElement('br'));

  const images_container = document.createElement('div');
  images_container.setAttribute('class', 'images-container');

  ground.append(thumbnail_wrapper);
  ground.append(document.createElement('sl-divider'));

  thumbnail_wrapper.append(images_container);

  // 서비스 워커에 패키지 조회를 요청합니다.
  const response = await chrome.runtime.sendMessage({
    action: 'getConPackage',
    packageId: packageId,
  });
  const query = response.data || [];
  
  if(query.length === 0 || query[0].image === undefined){
    const goto = document.createElement('sl-button');
    goto.setAttribute('size', 'small');
    goto.textContent = '데이터 수집하러 가기';
    goto.addEventListener('click', () => {
      chrome.tabs.update({ url: `https://arca.live/e/${packageId}` });
    });
    thumbnail_wrapper.append(goto);
  } else {
    query.forEach((element) => {
      const conBase = document.createElement('img');
      conBase.setAttribute('loading', 'lazy');
      conBase.setAttribute('class', 'thumbnail');
      conBase.setAttribute('src', element.image);
      conBase.setAttribute('data-id', element.conId);
      images_container.append(conBase);
    });
  }
}

async function conListup() {
  const ground = document.getElementById('conWrap');
  ground.innerHTML = '';
  if (customSort && customSort.length === 0) {
    ground.innerHTML = `
    아카콘 목록이 비어있습니다.<br/>
    댓글창의 아카콘버튼을 누른 뒤<br/>
    '아카콘 목록 가져오기' 버튼을 눌러주세요.`;
  } else {
    for (const pId of customSort) {
      if(pId in packageList) await showConPackage(pId, packageList[pId].title);
    }
  }
}

document.getElementById('comboCon').addEventListener('click', (e) => {
  comboState = !comboState;
  document.getElementById('comboCon').innerHTML = comboState
    ? '콤보 활성'
    : '콤보 비활성';

  if (comboState) {
    // 콤보콘 설정이 활성화 되었을때
  } else {
    conPackage = [];
    document.getElementById('comboConWrap').innerHTML = '';
  }
});

// 콤보콘 게시
document.getElementById('recordCombocon').addEventListener('click', () => {
  sendActivity('recordCombocon', conPackage);
  document.getElementById('comboCon').click();
});

// 콤보콘 목록 클릭-삭제
document.getElementById('comboConWrap').addEventListener('click', () => {
  console.log('asdf');
});

// 로컬 스토리지에 콘 패키지 업데이트
document.getElementById('conListUpdate').addEventListener('click', async () => {
  try {
    const { status, data, message, variant } = await sendActivity('conLinstUpdate');
    if (status === 'ok') {
      notify(message, 'success');
      conListup();
    } else if (status === 'fail'){
      notify(message, 'warning');
    } else {
      notify(message, 'danger');
    }
  } catch (error) {
    console.error(error);
    notify(error.message, 'danger');
  }
});

// 아카콘 클릭
document.getElementById('conWrap').addEventListener('click', async (e) => {
  // 클릭된 요소가 .thumbnail인지 확인
  const groupEl = e.target.closest('.package-wrap');
  const groupId = groupEl ? groupEl.getAttribute('data-package-id') : null;
  const thumbnail = e.target.closest('.thumbnail');
  const conId = thumbnail ? thumbnail.getAttribute('data-id') : null;

  if (conId && comboState) {
    addCombocon(groupId, conId, thumbnail.cloneNode(true));
  } else {
    sendActivity('recordEmoticon', {
      emoticonId: groupId,
      attachmentId: conId,
    });
  }
});

document.getElementById('listModify').addEventListener('click', () => {
  chrome.tabs.update({ url: 'https://arca.live/settings/emoticons' });
});

conListup();
