'use strict';

import './popup.css';
import { notify } from './notify.ts';
import db from './database';
import * as JSZip from 'jszip';
import ScrollSpy from 'scrollspy-js';
import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';

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
  thumbnail_wrapper.id = `${packageId}`; // scrollspy-js가 참조할 id 추가
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

  // 이모티콘 사진 쿼리
  const query = await db.emoticon.where('packageId').equals(packageId).sortBy('conOrder');
  
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
      conBase.setAttribute('src', URL.createObjectURL(element.image));
      conBase.setAttribute('data-id', element.conId);
      images_container.append(conBase);
    });
  }
}

async function conListup() {
  // 아카콘 대표 목록
  const headerGround = document.getElementById('conHeaders');
  headerGround.innerHTML = '';
  const heads = await db.base_emoticon.toArray();
  const objHeads = {}
  heads.forEach((head) => {
    objHeads[head.packageId] = head.src;
  });
  // 아바타의 href 속성을 설정하여 scrollspy-js가 타겟을 찾을 수 있도록 합니다.
  customSort.forEach(pId =>{
    // scrollspy-js는 <a> 태그의 href를 참조하므로, <a> 태그를 생성합니다.
    const anchor = document.createElement('a');
    anchor.href = `#${pId}`;

    const imgElement = document.createElement('sl-avatar');
    imgElement.setAttribute('data-id', pId);
    imgElement.setAttribute('image', URL.createObjectURL(objHeads[pId]));

    anchor.append(imgElement);
    headerGround.append(anchor);
});

  // 아카콘 상세 이미지들 (스크롤 대상 컨테이너)
  const ground = document.getElementById('conWrap');
  ground.innerHTML = '';
  if (!customSort || customSort.length === 0) {
    ground.innerHTML = `
    아카콘 목록이 비어있습니다.<br/>
    댓글창의 '아카콘 목록 저장' 버튼을 눌러주세요.`;
  } else {
    for (const pId of customSort) {
      if(pId in packageList) await showConPackage(pId, packageList[pId].title);
    }

    const navBar = document.getElementById('conHeaders');
    const navHeight = navBar ? navBar.offsetHeight : 0;

    const spy = new ScrollSpy('body', {
      nav: '#conHeaders a',
      className: 'in-view',
      offset: navHeight + 10,
      // onActive 대신 callback 옵션을 사용합니다.
      // 스크롤 시 활성화된 메뉴 아이템을 찾아 중앙으로 스크롤합니다.
      callback: () => {
        const activeItem = document.querySelector('#conHeaders a.in-view');
        if (activeItem) {
          const navContainer = document.getElementById('conHeaders');
          const containerWidth = navContainer.offsetWidth;
          const itemLeft = activeItem.offsetLeft;
          const itemWidth = activeItem.offsetWidth;

          const scrollLeft = itemLeft - (containerWidth / 2) + (itemWidth / 2);

          navContainer.scrollTo({
            left: scrollLeft,
            behavior: 'smooth',
          });
        }
      },
    });
  }
}

async function downloadResource(url) {
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

async function downloadTags(packageIds){
  const z = JSZip();
  const yymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const loading = packageIds.map(async (packageId) => {
    const { status, data:tags } = await chrome.runtime.sendMessage({ action: 'getTags', data: Number(packageId) });
    // JSZip은 문자열을 직접 받을 수 있으므로 Blob을 생성할 필요가 없습니다.
    const content = JSON.stringify(tags, null, 2);
    return { packageId, content };
  });
  const done = await Promise.all(loading);

  done.forEach((file) => {
    z.file(`${file.packageId}-${yymmdd}.json`, file.content);
  })
  const file = await z.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(file);
  try{
    chrome.downloads.download({
      url: url,
      filename: `arcacons-tags-${yymmdd}.zip`, // 여러 json을 압축했으므로 .zip 확장자가 더 적절합니다.
      saveAs: true,
    });
  }catch(e){
    console.log(e);
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

const dialog = document.querySelector('.dialog-overview');
const openButton = document.getElementById('dialog-test');
const closeButton = document.getElementById('closeDialogBtn');

openButton.addEventListener('click', () => dialog.show());
closeButton.addEventListener('click', () => dialog.hide());
  

// 로컬 스토리지에 콘 패키지 업데이트
// document.getElementById('conListUpdateBtn').addEventListener('click', async () => {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     if (!tab) {
//       throw new Error('활성화된 탭을 찾을 수 없습니다.');
//     }
//     const { status, message, data:headCons } = await chrome.tabs.sendMessage(tab.id, { action: 'getHeadArcacons' });
//     console.log(test);
//     if (status === 'ok') {
//       try{
//         const r = headCons.map(async (el) => {
//           return {
//             packageId: el.packageId,
//             src: await downloadResource(el.url),
//           }
//         });
//         const downloaed = await Promise.all(r);
//         await db.base_emoticon.bulkPut(downloaed);
//       } catch(e){
//         console.error(e);
//       }
//       notify(message, 'success');
//       conListup();
//     }
//     else if (status === 'fail') { notify(message, 'warning') }
//     else { notify(message, 'danger') }

//   } catch (error) {
//     console.error(error);
//     notify(error.message, 'danger');
//   }
// });


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

// document.getElementById('export-test').addEventListener('click', async () => {
//   const packageId = "2432";
//   await downloadTags([packageId]);
// });

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

customSort.forEach(pid => {
  const box = document.createElement('sl-checkbox');
  box.name = "package"
  box.value = pid;
  box.innerHTML = packageList[pid].packageName;

  document.getElementById('downloadBox').append(box);
  document.getElementById('downloadBox').append(document.createElement('br'));
});

document.getElementById('downloadForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  if(data.package === undefined) return;
  if(typeof(data.package) === 'string') data.package = [data.package];
  downloadTags(data.package);
});

document.getElementById('downloadBoxInit').addEventListener('click', () => {
  document.querySelectorAll('div#downloadBox sl-checkbox').forEach((el) => {
    el.checked = false;
  });
});

conListup();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
  switch (msg.action) {
    case 'saveArcacons':
      const data = msg.data;
      data.map(async (el) => {
        el.image = await downloadResource(el.image);
        el.video = await downloadResource(el.video);
      });
      console.log(data);
      break;
  }
  })();
  return true; // 비동기 응답을 위해 true를 반환합니다.
});