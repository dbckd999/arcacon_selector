'use strict';

import '../css/popup.css';

import { notify } from '../util/notify';
import db from '../database';
import * as JSZip from 'jszip';
import ScrollSpy from 'scrollspy-js';
import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';

import '../popupSetting';
import '../searchDetail';
import './jsonImport';

// 저장된 콘 패키지 목록 순회
const packageList = (await chrome.storage.local.get('arcacon_package')).arcacon_package ?? [];
const customSort = (await chrome.storage.local.get('arcacon_enabled')).arcacon_enabled ?? [];
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
      try {
        conBase.setAttribute('src', URL.createObjectURL(element.image));
      } catch (e) {
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
  const objHeads = {};
  heads.forEach((head) => {
    objHeads[head.packageId] = head.src;
  });

  // 아바타의 href 속성을 설정하여 scrollspy-js가 타겟을 찾을 수 있도록 합니다.
  customSort.forEach((pID) => {
    if(!packageList[pID].visible) return;
    
    // scrollspy-js는 <a> 태그의 href를 참조하므로, <a> 태그를 생성합니다.
    const anchor = document.createElement('a');
    anchor.href = `#${pID}`;

    const imgElement = document.createElement('sl-avatar');
    imgElement.setAttribute('data-id', pID);
    imgElement.setAttribute('image', URL.createObjectURL(objHeads[pID]));

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
      if (pId in packageList && packageList[pId].visible) await showConPackage(pId, packageList[pId].title);
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

async function downloadTags(packageIds) {
  const z = JSZip();
  const yymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const loading = packageIds.map(async (packageId) => {
    const { status, data: tags } = await chrome.runtime.sendMessage({
      action: 'getTags',
      data: Number(packageId),
    });
    // JSZip은 문자열을 직접 받을 수 있으므로 Blob을 생성할 필요가 없습니다.
    const content = JSON.stringify(tags, null, 2);
    return { packageId, content };
  });
  const done = await Promise.all(loading);

  done.forEach((file) => {
    z.file(`${file.packageId}-${yymmdd}.json`, file.content);
  });
  const file = await z.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(file);
  try {
    chrome.downloads.download({
      url: url,
      filename: `arcacons-tags-${yymmdd}.zip`, // 여러 json을 압축했으므로 .zip 확장자가 더 적절합니다.
      saveAs: true,
    });
  } catch (e) {
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
document
  .getElementById('recordCombocon')
  .addEventListener('click', async () => {
    conReady = false;
    document.getElementById('comboCon').click();
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const { status } = await chrome.tabs.sendMessage(tab.id, {
      action: 'recordCombocon',
      data: conPackage,
    });
    if (status === 'ok') {
      conReady = true;
    } else {
      notify(status, 'danger');
    }
  });

// 아카콘 클릭
let conReady = true;
document.getElementById('conWrap').addEventListener('click', async (e) => {
  // 클릭된 요소가 .thumbnail인지 확인
  const groupEl = e.target.closest('.package-wrap');
  const groupId = groupEl ? groupEl.getAttribute('data-package-id') : null;
  const thumbnail = e.target.closest('.thumbnail');
  const conId = thumbnail ? thumbnail.getAttribute('data-id') : null;
  const title = e.target.closest('.package-title');

  if (title) {
    // 패키지 제목 클릭 시
    chrome.tabs.update({ url: `https://arca.live/e/${groupId}` });
  } else if (thumbnail) {
    // 썸네일 이미지 클릭 시
    if (conReady && isCombo) {
      // 단순 엘리먼트 추가
      addCombocon(groupId, conId, thumbnail.cloneNode(true));
    } else if (conReady && !isCombo) {
      try {
        conReady = false;
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        const { status } = await chrome.tabs.sendMessage(tab.id, {
          action: 'recordEmoticon',
          data: {
            emoticonId: groupId,
            attachmentId: conId,
          },
        });
        if (status === 'ok') {
          conReady = true;
        } else {
          notify('아카라이브의 콘솔을 확인해주세요.', 'danger');
        }
      } catch (e) {
        conReady = true;
        notify(e, 'danger');
        console.error(e);
      }
    } else {
      notify('전송중입니다.', 'warning', 3000);
    }
  }
});

// 목록 수정하러가기
document.getElementById('listModify').addEventListener('click', () => {
  chrome.tabs.update({ url: 'https://arca.live/settings/emoticons' });
});

// 태그 내보내기
document.getElementById('downloadForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  if (data.package === undefined) return;
  if (typeof data.package === 'string') data.package = [data.package];
  downloadTags(data.package);
});

// 아카콘 대표목록 가로휠
document.getElementById('conHeaders').addEventListener('wheel', (e) => {
  if (e.deltaX === 0 && Math.abs(e.deltaY) > 0) {
    conHeaders.scrollLeft += e.deltaY;
    e.preventDefault();
  }
});

// 아카콘 대표 이미지 클릭 시 오프셋을 적용하여 스크롤하는 기능
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
    const offsetPosition =
      elementPosition + document.documentElement.scrollTop - offset;

    // 계산된 위치로 부드럽게 스크롤
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }
});

// 아카콘 가리기/보이기 설정
document.getElementById('is-show').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  const option = (await chrome.storage.local.get('arcacon_setting')).arcacon_setting;
  option.syncSearch = (data.syncSearch === 'on');
  chrome.storage.local.set({ arcacon_setting: option });
  
  const pOption = (await chrome.storage.local.get('arcacon_package')).arcacon_package;
  Object.keys(pOption).forEach((pID) => {
    pOption[pID].visible = (data[pID] === 'on');
  });
  chrome.storage.local.set({ arcacon_package: pOption });
});

function main() {
  // 백그라운드에 패널의 열림/닫힘 상태를 알립니다.
  chrome.runtime.connect({ name: 'sidepanel-connection' });

  // 초기 offset 값을 계산합니다.
  updateScrollSpyOffset();
  // nav 요소의 크기가 변경될 때마다 offset 값을 다시 계산하도록 ResizeObserver를 설정합니다.
  const navBar = document.querySelector('nav');
  if (navBar) {
    const resizeObserver = new ResizeObserver(updateScrollSpyOffset);
    resizeObserver.observe(navBar);
  }
  
  const showDataBase = document.getElementById('showData');
  customSort.forEach((pID) => {
    // 내보내기 체크박스 목록
    const outmsg = document.createElement('sl-icon');
    outmsg.setAttribute('name', 'box-arrow-up-right');
    outmsg.style.paddingLeft = '5px';
    outmsg.addEventListener('click', () => {
      chrome.tabs.update({ url: `https://arca.live/e/${pID}` });
    });

    const box = document.createElement('sl-checkbox');
    box.name = 'package';
    box.value = pID;
    box.innerHTML = packageList[pID].packageName + '  ';

    const li = document.createElement('li');
    li.append(box);
    li.append(outmsg);

    document.getElementById('downloadBox').append(li);

    // 아카콘관리-아카콘 숨기기/보이기
    const showTargetLi = document.createElement('li');
    const showTarget = document.createElement('sl-switch');
    showTarget.setAttribute('name', pID);
    showTarget.innerText = packageList[pID].title;
    showTarget.checked = packageList[pID].visible;
    showTargetLi.append(showTarget);
    showDataBase.append(showTargetLi);
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'popupSettingMessage') {
      const dialog = document.getElementById('app-setting');
      dialog.show();
    }
    if (msg.action === 'arcaconSettingMessage') {
      const dialog = document.getElementById('data-manamge');
      dialog.show();
    }
  });

  // 설정값 불러온 뒤 동작
  chrome.storage.local.get('arcacon_setting').then((res) => {
    const setting = res.arcacon_setting;

    // 절전화면 활성
    if (setting.isSleep == 'true') {
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
      .images-container img {
        width: ${setting.conSize}px;
        height: ${setting.conSize}px;
      }
      `;
      conListup();
    }

  });
}

main();

// 기본값은 알아서 가져옴
// const setting = new SettingsStore();
