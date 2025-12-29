import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';
import { notify } from '../util/notify';
import * as JSZip from 'jszip';

import * as state from './state';
import db from '../database';

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
  packageIds = packageIds.map(Number);
  const heads =
    (await browser.storage.local.get('arcacon_package')).arcacon_package || {};

  const promises = packageIds.map(async (pID) => {
    const headInfo = (await db.package_info.get(pID)) || {};
    const emoticon = await db.emoticon.where('packageId').equals(pID).toArray();
    return [
      pID,
      {
        packageID: pID,
        headerTag: headInfo.tags || [],
        atLocal: {
          packageName: heads[pID].packageName,
          title: heads[pID].title,
        },
        emoticon: emoticon
          .map(({ conId, tags }) => ({ conId, tags }))
          .filter((e) => e.tags),
      },
    ];
  });

  // pID: value 형태의 객체로 다시 복원
  const done = Object.fromEntries(await Promise.all(promises));

  const z = JSZip();
  const yymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const packageInfo =
    (await browser.storage.local.get('arcacon_package')).arcacon_package || {};
  for (const packageId of packageIds) {
    const value = done[packageId];
    if (!value) continue;

    const content = JSON.stringify(value, null, 2);
    z.file(`${packageInfo[packageId].packageName}(${packageId}).json`, content);
  }

  const file = await z.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(file);

  try {
    browser.downloads.download({
      url,
      filename: `arcacons-tags-${yymmdd}.zip`,
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
const advencedSearchBtn = document.getElementById('advSearch');
const nomalSearch = document.getElementById('nomalSearch');
const searchConWrap = document.querySelector(
  'div#searchResult div.images-container'
);
const releaseLink = document.getElementById('releaseLink');
const release = document.getElementById('release');
const syncToLocal = document.getElementById('syncToLocal');

// 아카콘 가리기/보이기 설정
isShow.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = serialize(e.target);
  try {
    // 검색결과와 연동
    const option = (await browser.storage.local.get('arcacon_setting'))
      .arcacon_setting;
    option.syncSearch = data.syncSearch === 'on';
    browser.storage.local.set({ arcacon_setting: option });

    const pOption = (await browser.storage.local.get('arcacon_package'))
      .arcacon_package;
    Object.keys(pOption).forEach((pID) => {
      pOption[pID].visible = data[pID] === 'on';
    });
    browser.storage.local.set({ arcacon_package: pOption });

    browser.runtime.sendMessage({ action: 'indexUpdate' });
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
  console.log('삭제될 데이터', data);
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
  browser.storage.local.set({ arcacon_package: state.packageList });
  browser.storage.local.set({ arcacon_enabled: state.customSort });
  // 검색 인덱싱 갱신 요청
  browser.runtime.sendMessage({ action: 'indexUpdate' });

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
comboCon.addEventListener('sl-change', async (e) => {
  await e.target.updateComplete;
  isCombo = e.target.hasAttribute('checked');
  if (isCombo) {
    // 콤보콘 설정이 활성화 되었을때
    repleyComboBtn.removeAttribute('disabled');
  } else {
    repleyComboBtn.setAttribute('disabled', true);
    state.conPackage.pop();
    state.conPackage.pop();
    state.conPackage.pop();
    document.getElementById('comboConWrap').innerHTML = '';
  }
});

// 콤보콘 이미지클릭시 삭제
comboConWrap.addEventListener('click', (e) => {
  const thumbnail = e.target.closest('img');
  if (thumbnail) thumbnail.remove();
  // n번째 계산
  const idx = Array.from(comboConWrap.children).indexOf(thumbnail);
  state.conPackage.splice(idx, 1);
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

  targetElement.scrollIntoView({ top: targetElement, behavior: 'smooth' });
});

// 콤보콘 게시
recordCombocon.addEventListener('click', async () => {
  conReady = false;
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const { status } = await browser.tabs.sendMessage(tab.id, {
    action: 'recordCombocon',
    data: state.conPackage,
  });
  if (status === 'ok') {
    conReady = true;
  } else {
    notify(status, 'danger');
  }
  document.getElementById('comboCon').click();
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
    browser.tabs.update({ url: `https://arca.live/e/${groupId}` });
  } else if (thumbnail) {
    // 썸네일 이미지 클릭 시
    if (conReady && isCombo) {
      // 단순 엘리먼트 추가
      addCombocon(groupId, conId, thumbnail.cloneNode(true));
    } else if (conReady && !isCombo) {
      try {
        conReady = false;
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const { status } = await browser.tabs.sendMessage(tab.id, {
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

// 아카콘 우클릭
conWrap.addEventListener('contextmenu', async (e) => {
  // 클릭된 요소가 .thumbnail인지 확인
  const thumbnail = e.target.closest('.thumbnail');
  const tooltip = e.target.closest('sl-tooltip');

  if (thumbnail) {
    e.preventDefault();

    const data = await db.emoticon.get(
      Number(thumbnail.getAttribute('data-id'))
    );
    if (data.video) {
      thumbnail.hidden = true;
      const video = document.createElement('video');
      video.src = URL.createObjectURL(data.video);
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.classList.add('thumbnail');
      video.classList.add('is-playing');
      tooltip.querySelector('div.media').append(video);
    }

    tooltip.open = true;
    setTimeout(() => {
      thumbnail.hidden = false;
      if (data.video)
        tooltip
          .querySelector('div.media')
          .removeChild(tooltip.querySelector('video'));
      tooltip.open = false;
    }, 3000);
  }
});

// 검색결과 클릭
searchConWrap.addEventListener('click', async (e) => {
  const thumbnail = e.target.closest('.thumbnail');

  if (thumbnail) {
    const conId = thumbnail ? thumbnail.getAttribute('data-id') : null;
    const { packageId: groupId } = await db.emoticon.get(Number(conId));

    // 썸네일 이미지 클릭 시
    if (conReady && isCombo) {
      // 단순 엘리먼트 추가
      addCombocon(groupId, conId, thumbnail.cloneNode(true));
    } else if (conReady && !isCombo) {
      try {
        conReady = false;
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const { status } = await browser.tabs.sendMessage(tab.id, {
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

// 검색결과 우클릭
searchConWrap.addEventListener('contextmenu', async (e) => {
  e.preventDefault();

  const thumbnail = e.target.closest('.thumbnail');

  if (thumbnail) {
    const conId = thumbnail ? thumbnail.getAttribute('data-id') : null;
    const searchOrigin = document.querySelector(
      "div#conWrap div.images-container img[data-id='" + conId + "']"
    );
    searchOrigin.scrollIntoView({ block: 'center' });

    searchOrigin.animate(
      [{ borderWidth: '25px' }, { borderWidth: '0px' }],
      1000
    );
  }
});

// 고급검색으로 전환
advencedSearchBtn.addEventListener('click', () => {
  document.getElementById('tagInput').style.display = 'none';
  document.getElementById('acvenceTag').style.display = 'block';
});

// 일반검색으로 전환
nomalSearch.addEventListener('click', () => {
  document.getElementById('acvenceTag').style.display = 'none';
  document.getElementById('tagInput').style.display = 'block';
});

// 고급 검색결과 제출
document.getElementById('acvenceTag').addEventListener('submit', async (e) => {
  e.preventDefault();
  const searchResultEl = document.querySelector(
    'div#searchResult div.images-container'
  );
  searchResultEl.innerHTML = '';

  const data = serialize(e.target);
  if (data.tag) {
    const { status, data: conIDs } = await browser.runtime.sendMessage({
      action: 'advencedSearch',
      data: data.tag,
    });
    if (status === 'ok') {
      db.emoticon.bulkGet(conIDs).then((cons) => {
        cons.forEach((con) => {
          const thumbnail = document.createElement('img');
          thumbnail.setAttribute('loading', 'lazy');
          thumbnail.setAttribute('class', 'thumbnail');
          thumbnail.src = URL.createObjectURL(con.image);
          thumbnail.setAttribute('data-id', con.conId.toString());
          searchResultEl.append(thumbnail);
        });
      });
    }
  }
});

syncToLocal.addEventListener('click', async () => {
  const data = await browser.storage.sync.get([
    'arcacon_package',
    'arcacon_enabled',
    'arcacon_setting',
  ]);
  const setting = (await browser.storage.local.get(['arcacon_setting']))
    .arcacon_setting;

  try {
    if (setting.syncArcacons)
      browser.storage.local.set({ arcacon_package: data.arcacon_package });
    if (setting.syncArcacons)
      browser.storage.local.set({ arcacon_enabled: data.arcacon_enabled });
    if (setting.syncSetting)
      browser.storage.local.set({ arcacon_setting: data.arcacon_setting });
  } catch (e) {
    notify(e, 'danger');
  }
  notify('계정에서 데이터를 연동했습니다.', 'success');
});

// 설정이 켜질때 로컬값이 계정과 바로 연동
const syncSetting = document.querySelector(
  'sl-switch[data-setting=syncSetting]'
);
syncSetting.addEventListener('sl-change', async (e) => {
  await e.target.updateComplete;
  // 더미데이터로 onChanged이벤트 발생
  browser.storage.local.set({ wow: Date.now() });
});

// 설정이 켜질때 로컬값이 계정과 바로 연동
const syncArcacons = document.querySelector(
  'sl-switch[data-setting=syncArcacons]'
);
syncArcacons.addEventListener('sl-change', async (e) => {
  await e.target.updateComplete;
  // 더미데이터로 onChanged이벤트 발생
  browser.storage.local.set({ wow: Date.now() });
});

// 릴리즈노트 다이얼로그창
releaseLink.addEventListener('click', () => {
  release.show();
});

const drawer = document.querySelector('.drawer');
const openButton = document.getElementById('searchHelp');
openButton.addEventListener('click', () => (drawer.open = !drawer.open));

const links = document.getElementsByClassName('newtab');
for (let el of links) {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const url = el.getAttribute('href');
    browser.tabs.create({ url });
  });
}
