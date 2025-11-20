'use strict';

import './popup.css';
import { notify } from './notify.ts';
import db from './database';
import * as JSZip from 'jszip';
import ScrollSpy from 'scrollspy-js';
import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';

import './popupSetting'

// 백그라운드 스크립트와 연결하여 패널의 열림/닫힘 상태를 알립니다.
chrome.runtime.connect({ name: "sidepanel-connection" });

import './searchDetail'

// 저장된 콘 패키지 목록 순회
const { arcacon_package: packageList } = await chrome.storage.local.get('arcacon_package');
const { arcacon_enabled: customSort } = await chrome.storage.local.get('arcacon_enabled');
let conPackage = [];
let isCombo = false;

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

  // 아카콘 제목
  const title = document.createElement('span');
  title.textContent = pakcageName;
  title.addEventListener('click', (e)=>{
    chrome.tabs.update({ url: `https://arca.live/e/${packageId}` });
  });
  thumbnail_wrapper.append(title);
  thumbnail_wrapper.append(document.createElement('br'));

  // 이미지 그룹
  const images_container = document.createElement('div');
  images_container.setAttribute('class', 'images-container');
  thumbnail_wrapper.append(images_container);

  ground.append(thumbnail_wrapper);
  ground.append(document.createElement('sl-divider'));

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
    // 이미지 그룹에 사진 추가
    query.forEach((element) => {
      const conBase = document.createElement('img');
      conBase.setAttribute('loading', 'lazy');
      conBase.setAttribute('class', 'thumbnail');
      // 다운로드 에러나면서 꼬이는듯?
      try{
        conBase.setAttribute('src', URL.createObjectURL(element.image));
      } catch(e){
        console.error(packageId, pakcageName, element.conId);
      }
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

    const spy = new ScrollSpy('nav', {
      nav: '#conHeaders a',
      className: 'in-view',
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

// ScrollSpy의 isInView 함수를 재정의하여 offset 기능 추가
ScrollSpy.prototype.isInView = function (el) {
  // 하드코딩된 위치
  const navBar = document.querySelector('nav');
  const navHeight = navBar ? navBar.offsetHeight : 0;
  const offset = navHeight + 10;

  const rect = el.getBoundingClientRect();

  // 요소의 상단이 offset보다 위에 있고, 요소의 하단이 offset보다 아래에 있을 때 true를 반환합니다.
  // 즉, offset 라인이 요소를 가로지를 때 활성화됩니다.
  return rect.top <= offset && rect.bottom >= offset;
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

// 콤보콘 상태변경
const repleyComboBtn = document.getElementById('recordCombocon');
document.getElementById('comboCon').addEventListener('sl-change', (e) => {
  isCombo = !e.target.hasAttribute('checked');
  if (isCombo) {
    // 콤보콘 설정이 활성화 되었을때
    repleyComboBtn.removeAttribute('disabled');
  } else {
    repleyComboBtn.setAttribute('disabled', true);
    conPackage = [];
    document.getElementById('comboConWrap').innerHTML = '';
  }
});

// 콤보콘 이미지클릭시 삭제
document.getElementById('comboConWrap').addEventListener('click', (e) => {
  const thumbnail = e.target.closest('img');
  if (thumbnail) {
    thumbnail.remove();
  }
});

// 콤보콘 게시
document.getElementById('recordCombocon').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, async (tabs)=>{
    await chrome.tabs.sendMessage(tabs[0].id, {action: "recordCombocon", data: conPackage });
    document.getElementById('comboCon').click();
    });
});

// 아카콘 클릭
document.getElementById('conWrap').addEventListener('click', async (e) => {
  // 클릭된 요소가 .thumbnail인지 확인
  const groupEl = e.target.closest('.package-wrap');
  const groupId = groupEl ? groupEl.getAttribute('data-package-id') : null;
  const thumbnail = e.target.closest('.thumbnail');
  const conId = thumbnail ? thumbnail.getAttribute('data-id') : null;

  if(thumbnail){
    if (conId && isCombo) {
      addCombocon(groupId, conId, thumbnail.cloneNode(true));
    } else {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs)=>{
          chrome.tabs.sendMessage(tabs[0].id, {action: "recordEmoticon", data: {
            emoticonId: groupId,
            attachmentId: conId,
          }}).catch(e => {
            notify(e, 'danger');
            console.error(e);
          });
      });
    }
  }
});

// 목록 수정하러가기
document.getElementById('listModify').addEventListener('click', () => {
  chrome.tabs.update({ url: 'https://arca.live/settings/emoticons' });
});

document.getElementById('downloadForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  if(data.package === undefined) return;
  if(typeof(data.package) === 'string') data.package = [data.package];
  downloadTags(data.package);
});

customSort.forEach(pid => {
  const outmsg = document.createElement('sl-icon');
  outmsg.setAttribute('name', 'box-arrow-up-right');
  outmsg.style.paddingLeft = '5px';
  outmsg.addEventListener('click', () => {
    chrome.tabs.update({ url: `https://arca.live/e/${pid}` });
  });

  const box = document.createElement('sl-checkbox');
  box.name = "package"
  box.value = pid;
  box.innerHTML = packageList[pid].packageName + '  ';
  
  const li = document.createElement('li');
  li.append(box);
  li.append(outmsg);

  document.getElementById('downloadBox').append(li);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if(msg.action === 'popupSettingMessage'){
      const dialog = document.querySelector('.dialog-overview');
      dialog.show()
    }
});

// 아카콘 대표목록 가로휠 적용
document.getElementById('conHeaders').addEventListener('wheel', (e) => {
  if (e.deltaX === 0 && Math.abs(e.deltaY) > 0) {
    conHeaders.scrollLeft += e.deltaY;
    e.preventDefault();
  }
});

// 네비게이션 아이템 클릭 시 오프셋을 적용하여 스크롤하는 기능
document.getElementById('conHeaders').addEventListener('click', (e) => {
  // 클릭된 요소가 <a> 태그인지 확인
  const anchor = e.target.closest('a');
  if (!anchor) return;

  // 기본 앵커 동작(즉시 스크롤)을 막습니다.
  e.preventDefault();

  const href = anchor.getAttribute('href');
  if (!href || href === '#') return;

  const targetId = href.substring(1);
  const targetElement = document.getElementById(targetId);

  if (targetElement) {
    const navBar = document.querySelector('nav');
    const navHeight = navBar ? navBar.offsetHeight : 0;
    // isInView에서 사용한 오프셋과 동일하게 설정
    const offset = navHeight;

    const elementPosition = targetElement.getBoundingClientRect().top;
    const offsetPosition = elementPosition + document.documentElement.scrollTop - offset;

    // 계산된 위치로 부드럽게 스크롤
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }
});

// 설정값 불러온 뒤 동작
chrome.storage.local.get('arcacon_setting').then(res => {
  const setting = res.arcacon_setting;

  // 절전화면 활성
  if(setting.isSleep == 'true'){
    // 절전화면 시작시간
    if(setting.sleepTime){

      //보호화면
      const shild = document.getElementById('shild');
      const root = document.querySelector('html');
      let shildTimeout;

      function showShild() {
        clearTimeout(shildTimeout);
        shildTimeout = setTimeout(() => {
          if (shild) {
            shild.style.opacity = setting.sleepOpacity,
            shild.style.visibility = 'visible';
          }
        }, Number(setting.sleepTime));
      }

      function hideShild() {
        if (shild) {
          clearTimeout(shildTimeout);
          shild.style.opacity = '0';
          shild.style.visibility = 'hidden';
        }
      }

      root.addEventListener('mouseenter', hideShild);
      root.addEventListener('mouseleave', showShild);
      showShild();
    }
  }
  // 아카콘 크기
  if(setting.conSize){
    document.getElementById('conStyle').innerText = `
    .images-container img {
      width: ${setting.conSize}px;
      height: ${setting.conSize}px;
    }
    `;
    conListup();
  }
});

import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Korean from '@uppy/locales/lib/ko_KR.js';

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

const upy = new Uppy({
  restrictions: {
    allowedFileTypes: ['.json']
  }
}).use(Dashboard, { 
  inline: true,
  target: '#uppy-dashboard',
  locale: Korean,
  theme: 'dark',
  note: 'JSON파일만 업로드 가능합니다.'
});

upy.on('file-added', async (file) => {
  try {
    const text = await file.data.text();  // Blob → text
    const json = JSON.parse(text);

    // 간단 검증 예시
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON structure');
    }

  } catch (e) {
    notify('유효하지 않은 JSON 파일입니다.', 'exclamation-triangle');
    upy.removeFile(file.id); // 잘못된 파일 제거
  }
});

upy.on('upload', async (uploadID, files) => {
  files.forEach(async (file) => {
    const text = await file.data.text();
    const json = JSON.parse(text);
    
    // 키 존재 확인. 없으면 무시됨
    const pId = Object.keys(json)[0];

    if(await db.emoticon.where('packageId').equals(Number(pId)).first() > 0){
      const emoticons = json[pId];
      const updates = [];
      Object.keys(emoticons).forEach((conId) => {
        updates.push({
          key: Number(conId),
          changes: { 
            tags: emoticons[conId],
          }
        });
      });

      if(updates.length > 0){
        db.emoticon.bulkUpdate(updates)
        .then(count => {
          notify(`${count}개의 아카콘 데이터를 업데이트했습니다.`);
        }).catch(e => {
          notify(e, 'danger');
          console.error(e);
        });
      } else {
        notify('업데이트할 데이터가 없습니다.');
      }

    }
  });
});
