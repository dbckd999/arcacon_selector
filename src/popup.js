'use strict';

import './popup.css';
import { notify } from './notify.ts';

// 저장된 콘 패키지 목록 순회
const { arcacon_package: packageList } = await chrome.storage.local.get('arcacon_package');
const { arcacon_enabled: customSort } = await chrome.storage.local.get('arcacon_enabled');
let conPackage = [];
let comboState = false;

function addCombocon(groupId, conId, thumbnail) {
  if (conPackage.length >= 3) {
    conPackage.shift();
    document.querySelector('div#comboConWrap *').remove();
  }
  conPackage.push([groupId, conId]);
  document.getElementById('comboConWrap').append(thumbnail);
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
  chrome.runtime.sendMessage({ action: 'recordCombocon', data: conPackage });
  document.getElementById('comboCon').click();
});

// 콤보콘 목록 클릭-삭제
document.getElementById('comboConWrap').addEventListener('click', () => {
  console.log('asdf');
});

// 로컬 스토리지에 콘 패키지 업데이트
document.getElementById('conListUpdate').addEventListener('click', async () => {
  try {
    const { status, data, message, variant } = await chrome.runtime.sendMessage({ action: 'conLinstUpdate' });
data:     if (status === 'ok') {
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
    chrome.runtime.sendMessage({ action: 'recordEmoticon', data: {
      emoticonId: groupId,
      attachmentId: conId,
    }
  });
  }
});

document.getElementById('listModify').addEventListener('click', () => {
  chrome.tabs.update({ url: 'https://arca.live/settings/emoticons' });
});

document.getElementById('export-test').addEventListener('click', async () => {
  const packageId = "2432";

  const { status, data:tags } = await chrome.runtime.sendMessage({ action: 'getTags', data: Number(packageId) });
  const blob = new Blob([JSON.stringify(tags, null, 2)], { type: 'application/json' });
  const yymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  try{
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: `${packageId}-${yymmdd}.json`,
      saveAs: true,
    });
  }catch(e){
    console.log(e);
  }
});

document.getElementById('import-test').addEventListener('click', async () => {
  // 1. 숨겨진 file input 요소를 만듭니다.
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json'; // JSON 파일만 선택하도록 필터링
  fileInput.style.display = 'none';

  // 2. 파일이 선택되면 처리할 이벤트 리스너를 추가합니다.
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const dataToImport = JSON.parse(content);
        console.log(dataToImport);

        // indexedDB 바인딩
        const pId = Object.keys(dataToImport)[0];
        const conIds = Object.keys(dataToImport[pId]);
        const toDB = [];
        for (const conId of conIds) {
          toDB.push({
            packageId: Number(pId),
            conId: Number(conId),
            tags: dataToImport[pId][conId],
          });
        }
        console.log(toDB);

        const response = await chrome.runtime.sendMessage({ action: 'updateTags', data: toDB });
        if (response.status === 'ok') {
          notify(response.message, 'success');
        } else {
          notify(response.message, 'danger');
        }
      } catch (error) {
        console.error('파일을 읽거나 파싱하는 중 오류 발생:', error);
        notify('유효하지 않은 JSON 파일입니다.', 'exclamation-triangle');
      }
    };
    reader.readAsText(file);
  });

  // 4. 파일 선택 창을 엽니다.
  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
});

conListup();
