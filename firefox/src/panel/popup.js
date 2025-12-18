'use strict';
import '@shoelace-style/shoelace/dist/themes/dark.css';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';

import '@shoelace-style/shoelace/dist/components/tag/tag.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/avatar/avatar.js';
import '@shoelace-style/shoelace/dist/components/popup/popup.js';

import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

import './emergency'

// 전역변수는 별도로 관리
import * as state from './state'
import '../css/popup.css';

import db from '../database';

import ScrollSpy from 'scrollspy-js';
import './popupSetting';
import '../searchDetail';
import './jsonImport';
import './listener'

document.getElementById('version').textContent = browser.runtime.getManifest().version;

// 특정 패키지 출력
async function showConPackage(packageId, pakcageName) {
  packageId = Number(packageId);
  const ground = document.getElementById('conWrap');
  const _thumbnail_wrapper = document.querySelector(
    `.package-wrap[data-package-id="${packageId}"]`
  );
  if (_thumbnail_wrapper) {
    _thumbnail_wrapper.remove();
  }
  if (state.customSort && state.customSort.indexOf(packageId) === -1) return;

  // 입력할 칸만 미리 만들어놓고 db관련은 비동기로 진행
  const thumbnail_wrapper = document.createElement('div');
  thumbnail_wrapper.setAttribute('class', 'package-wrap');
  thumbnail_wrapper.id = `${packageId}`; // scrollspy-js가 참조할 id 추가
  thumbnail_wrapper.setAttribute('data-package-id', packageId);

  // 아카콘 제목
  const title = document.createElement('span');
  title.className = 'package-title';
  title.textContent = pakcageName;
  thumbnail_wrapper.append(title);
  thumbnail_wrapper.append(document.createElement('br'));

  // 이미지 그룹
  const images_container = document.createElement('div');
  images_container.setAttribute('class', 'images-container');
  thumbnail_wrapper.append(images_container);

  ground.append(thumbnail_wrapper);
  ground.append(document.createElement('sl-divider'));

  // 이모티콘 사진 쿼리
  const query = await db.emoticon
    .where('packageId')
    .equals(packageId)
    .sortBy('conOrder');

  if (query.length === 0 || query[0].image === undefined) {
    const goto = document.createElement('sl-button');
    goto.setAttribute('size', 'small');
    goto.textContent = '데이터 수집하러 가기';
    goto.addEventListener('click', () => {
      browser.tabs.update({ url: `https://arca.live/e/${packageId}` });
    });
    thumbnail_wrapper.append(goto);
  } else {
    // 이미지 그룹에 사진 추가
    query.forEach((element) => {
      // 툴팁: 태그표시
      const tip = document.createElement('sl-tooltip');
      tip.setAttribute('placement', 'bottom');
      tip.setAttribute('trigger', 'manual');
      tip.style.display = 'inline-block';

      const content = document.createElement('div');
      content.setAttribute('slot', 'content');
      content.innerHTML = (element.tags) ? String(element.tags).replace(/,/g, '<br />') : '...';
      tip.append(content);

      const mediaWrap = document.createElement('div');
      mediaWrap.setAttribute('class', 'media');

      const conBase = document.createElement('img');
      conBase.setAttribute('loading', 'lazy');
      conBase.setAttribute('class', 'thumbnail');

      mediaWrap.append(conBase);
      // 다운로드 에러나면서 꼬이는듯?
      try {
        conBase.setAttribute('src', URL.createObjectURL(element.image));
      } catch (e) {
        console.error('blob객체 변환중 에러발생', packageId, pakcageName, element.conId);
      }
      conBase.setAttribute('data-id', element.conId);
      // tip.append(conBase);
      tip.append(mediaWrap);
      images_container.append(tip);
    });
  }
}

// 전체 아카콘 목록 출력
async function conListup() {
  // 아카콘 대표 목록
  const headerGround = document.getElementById('conHeaders');
  // headerGround.innerHTML = '';
  const heads = await db.base_emoticon.toArray();
  const objHeads = {};
  heads.forEach((head) => {
    objHeads[head.packageId] = head.src;
  });

  // 아바타의 href 속성을 설정하여 scrollspy-js가 타겟을 찾을 수 있도록 합니다.
  state.customSort.forEach((pID) => {
    if(!state.packageList[pID].visible) return;
    
    // scrollspy-js는 <a> 태그의 href를 참조하므로, <a> 태그를 생성합니다.
    const anchor = document.createElement('a');
    anchor.href = `#${pID}`;

    const imgElement = document.createElement('sl-avatar');
    imgElement.setAttribute('data-id', pID);
    try{
      imgElement.setAttribute('image', URL.createObjectURL(objHeads[pID]));
    } catch (e) {
      const empty = document.createElement('sl-icon');
      empty.setAttribute('slot', 'icon');
      empty.setAttribute('name', 'image');
      imgElement.append(empty);
      console.warn(`데이터가 비어있습니다. https://arca.live/e/${pID} 에서 '데이터 수집하기'나 댓글창의 '아카콘 목록 저장' 버튼을 눌러주세요.`);
    }

    anchor.append(imgElement);
    headerGround.append(anchor);
  });

  // 아카콘 상세 이미지들 (스크롤 대상 컨테이너)
  const ground = document.getElementById('conWrap');
  // ground.innerHTML = '';
  if (!state.customSort || state.customSort.length === 0) {
    ground.innerHTML = `
    아카콘 목록이 비어있습니다.<br/>
    댓글창의 '아카콘 목록 저장' 버튼을 눌러주세요.`;
  } else {
    for (const pId of state.customSort) {
      if (pId in state.packageList && state.packageList[pId].visible) await showConPackage(pId, state.packageList[pId].title);
    }

    new ScrollSpy('nav', {
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

          const scrollLeft = itemLeft - containerWidth / 2 + itemWidth / 2;

          navContainer.scrollTo({
            left: scrollLeft,
            behavior: 'smooth',
          });
        }
      },
    });
  }
}

// ScrollSpy에서 사용할 offset 값을 저장할 변수
let scrollSpyOffset = 0;

// offset 값을 계산, 업데이트
function updateScrollSpyOffset() {
  const navBar = document.querySelector('nav');
  const navHeight = navBar ? navBar.offsetHeight : 0;
  scrollSpyOffset = navHeight + 10;
}

// ScrollSpy의 isInView 함수를 재정의. offset 계산값 추가
// 하이라이트 대상 위치 재정의
ScrollSpy.prototype.isInView = function (el) {
  const rect = el.getBoundingClientRect();
  // 미리 계산된 offset 값을 사용하여 성능 향상
  return rect.top <= scrollSpyOffset && rect.bottom >= scrollSpyOffset;
};

// 아카콘 관리페이지 이동
document.getElementById('listModify').addEventListener('click', () => {
  browser.tabs.update({ url: 'https://arca.live/settings/emoticons' });
});


// 동적 항목을 주로 다룸
async function main() {
  // 0. 전역변수 초기화
  await state.initializeState();

  // 1. 백그라운드에 패널을 연결해 메뉴의 일부항목 활성
  browser.runtime.connect({ name: 'sidepanel-connection' });

  // 2. 콘 위치감지 오프셋 커스텀
  // 초기 offset 값을 계산합니다.
  updateScrollSpyOffset();
  // nav 요소의 크기가 변경될 때마다 offset 값을 다시 계산하도록 ResizeObserver를 설정합니다.
  const navBar = document.querySelector('nav');
  if (navBar) {
    const resizeObserver = new ResizeObserver(updateScrollSpyOffset);
    resizeObserver.observe(navBar);
  }
  
  // 3. 콘 정렬에 맞춰 동작
  const showDataBase = document.getElementById('showData');
  state.customSort.forEach((pID) => {
    // 3.1 내보내기 체크박스 목록
    const outmsg = document.createElement('sl-icon');
    outmsg.setAttribute('name', 'box-arrow-up-right');
    outmsg.style.paddingLeft = '5px';
    outmsg.addEventListener('click', () => {
      browser.tabs.update({ url: `https://arca.live/e/${pID}` });
    });
    
    const box = document.createElement('sl-checkbox');
    box.name = 'package';
    box.value = pID;
    box.innerHTML = state.packageList[pID].packageName + '  ';
    
    const li = document.createElement('li');
    li.append(box);
    li.append(outmsg);
    
    document.getElementById('downloadBox').append(li);
    
    // 3.2 아카콘관리-아카콘 숨기기/보이기
    const showTargetLi = document.createElement('li');
    const showTarget = document.createElement('sl-switch');
    showTarget.setAttribute('name', pID);
    showTarget.innerText = state.packageList[pID].title;
    showTarget.checked = state.packageList[pID].visible;
    showTargetLi.append(showTarget);
    showDataBase.append(showTargetLi);
  });
  
  // 4. 콘 삭제목록(보이는,가려진 + 사용불가능한)
  const deleteForm = document.getElementById('delete-data');
  state.customSort.forEach((pID) => {
    const li = document.createElement('li');
    const box = document.createElement('sl-checkbox');
    li.append(box);
    box.innerText = state.packageList[pID].title;
    box.setAttribute('name', pID);
    deleteForm.append(li);
  });
  
  
  // 5. 데이터 완료후 메뉴접근 활성화
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'popupSettingMessage') {
      const dialog = document.getElementById('app-setting');
      dialog.show();
    }
    if (msg.action === 'arcaconSettingMessage') {
      const dialog = document.getElementById('data-manamge');
      dialog.show();
    }
  });

  // 5. 설정값 앱에 적용
  browser.storage.local.get('arcacon_setting').then((res) => {
    const setting = res.arcacon_setting;

    // 절전화면 활성
    if (setting.isSleep) {
      //보호화면
      const shild = document.getElementById('shild');
      const root = document.querySelector('html');
      let shildTimeout;

      function showShild() {
        clearTimeout(shildTimeout);
        shildTimeout = setTimeout(() => {
          if (shild) {
            (shild.style.opacity = setting.sleepOpacity),
              (shild.style.visibility = 'visible');
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
    // 아카콘 크기
    if (setting.conSize) {
      document.getElementById('conStyle').innerText = `
      sl-tooltip div.media {
        position: relative;
        width: ${setting.conSize}px;
        height: ${setting.conSize}px;
      }
      `;
      conListup();
    }

  });

  document.querySelector('form#tagInput sl-input').focus();
}

main();
