import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';
import { notify } from '../util/notify';
import * as JSZip from 'jszip';

import * as state from './state';


// 콤보콘 활성시 게시 목록에 추가
function addCombocon(groupId, conId, thumbnail) {
  if (state.conPackage.length >= 3) {
    state.conPackage.shift();
    document.querySelector('div#comboConWrap *').remove();
  }
  state.conPackage.push([groupId, conId]);
  document.getElementById('comboConWrap').append(thumbnail);
}

// 패키지 목록 json파일화, zip파일로 다운로드.
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

let isCombo = false;

const isShow = document.getElementById('is-show');
const deleteForm = document.getElementById('delete-form');
const downloadForm = document.getElementById('downloadForm');
const comboCon = document.getElementById('comboCon');
const comboConWrap = document.getElementById('comboConWrap');
const conHeaders = document.getElementById('conHeaders');
const recordCombocon = document.getElementById('recordCombocon');


// 아카콘 가리기/보이기 설정
isShow.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  try{
  // 검색결과와 연동
  const option = (await chrome.storage.local.get('arcacon_setting')).arcacon_setting;
  option.syncSearch = (data.syncSearch === 'on');
  chrome.storage.local.set({ arcacon_setting: option });
  
  const pOption = (await chrome.storage.local.get('arcacon_package')).arcacon_package;
  Object.keys(pOption).forEach((pID) => {
    pOption[pID].visible = (data[pID] === 'on');
  });
  chrome.storage.local.set({ arcacon_package: pOption });
  
  chrome.runtime.sendMessage({ action: 'indexUpdate' });
  } catch (e) {
    console.error(e);
  }
  notify('설정을 저장했습니다.', 'check-circle');
  document.getElementById('data-manamge').hide();
});

// 아카콘 데이터 삭제
deleteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  console.log(data);
  const ids = Object.keys(data).map(Number);
  ids.forEach((id) => {
    // indexedDB에서 삭제
    db.emoticon.where('packageId').equals(id).delete();
    db.base_emoticon.where('packageId').equals(id).delete();
    // 로컬 스토리지 삭제
    delete state.packageList[id];
    // 정렬된 목록에서 삭제
    state.customSort.splice(state.customSort.indexOf(id), 1);
  });
  
  // 삭제 완료된 데이터 저장
  chrome.storage.local.set({ arcacon_package: state.packageList });
  chrome.storage.local.set({ arcacon_enabled: state.customSort });
  // 검색 인덱싱 갱신 요청
  chrome.runtime.sendMessage({ action: 'indexUpdate' });

  notify(`${ids.length}개의 아카콘 데이터를 삭제했습니다.
    다시 열어주세요.`);
});

// 태그 내보내기
downloadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  if (data.package === undefined) return;
  if (typeof data.package === 'string') data.package = [data.package];
  downloadTags(data.package);
});

// 콤보콘 상태변경
const repleyComboBtn = document.getElementById('recordCombocon');
comboCon.addEventListener('sl-change', (e) => {
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
comboConWrap.addEventListener('click', (e) => {
  const thumbnail = e.target.closest('img');
  if (thumbnail) {
    thumbnail.remove();
  }
});

// 아카콘 대표목록 가로휠
conHeaders.addEventListener('wheel', (e) => {
  if (e.deltaX === 0 && Math.abs(e.deltaY) > 0) {
    conHeaders.scrollLeft += e.deltaY;
    e.preventDefault();
  }
});

// 아카콘 대표 이미지 클릭 시 오프셋을 적용하여 스크롤하는 기능
conHeaders.addEventListener('click', (e) => {
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

// 콤보콘 게시
recordCombocon.addEventListener('click', async () => {
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
conWrap.addEventListener('click', async (e) => {
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