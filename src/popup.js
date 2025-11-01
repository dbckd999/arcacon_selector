'use strict';

import Dexie from 'dexie';
const db = new Dexie('Arcacons');
// 인덱싱되는 속성 정의
db.version(1).stores({ emoticon: '&conId, [packageId+conOrder], *tags' });
// 저장된 콘 패키지 목록 순회
const packageL = JSON.parse(localStorage.getItem('arcacon_package'));
const customSort = JSON.parse(localStorage.getItem('arcacon_enabled'));
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

function showConPackage(packageId, pakcageName) {
  packageId = Number(packageId);
  const ground = document.getElementById('conWrap');
  const _thumbnail_wrapper = document.querySelector(
    `.package-wrap[data-package-id="${packageId}"]`
  );
  if (_thumbnail_wrapper) {
    _thumbnail_wrapper.remove();
  }
  if (customSort && customSort.indexOf(packageId) === -1) return;

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

  db.emoticon
    .where('packageId')
    .equals(packageId)
    .sortBy('conOrder')
    .then((res) => {
      if (res.length === 0) {
        const goto = document.createElement('sl-button');
        goto.setAttribute('size', 'small');
        goto.textContent = '데이터 수집하러 가기';
        goto.addEventListener('click', () => {
          chrome.tabs.update({ url: `https://arca.live/e/${packageId}` });
        });
        thumbnail_wrapper.append(goto);
      }

      res.forEach((element) => {
        const conBase = document.createElement('img');
        conBase.setAttribute('loading', 'lazy');
        conBase.setAttribute('class', 'thumbnail');
        conBase.setAttribute('src', element.image);
        conBase.setAttribute('data-id', element.conId);
        images_container.append(conBase);
      });
    });
}

function conListup() {
  const ground = document.getElementById('conWrap');
  ground.innerHTML = '';
  if (packageL) {
    if (customSort) {
      (async () => {
        for (const pId of customSort) {
          showConPackage(pId, packageL[pId].title);
        }
      })();
    } else {
      (async () => {
        for (const pId of Object.keys(packageL)) {
          showConPackage(pId, packageL[pId].title);
        }
      })();
    }
  }
}

// shoelace --------------------------
document.getElementById('test').onclick(()=>{
  notify('test', 'danger');
});
function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

function notify(message, variant = 'primary', icon = 'info-circle', duration = 3000) {
  const alert = Object.assign(document.createElement('sl-alert'), {
    variant,
    closable: true,
    duration: duration,
    innerHTML: `
        <sl-icon name="${icon}" slot="icon"></sl-icon>
        ${escapeHtml(message)}
      `
  });

  document.body.append(alert);
  return alert.toast();
}

// shoelace --------------------------

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
  const conPackages = await sendActivity('conLinstUpdate');
  console.log(conPackages);
  localStorage.setItem('arcacon_package', conPackages);

  const enabledList = JSON.parse(localStorage.getItem('arcacon_enabled'));
  if (enabledList === null || enabledList.length === 0) {
    localStorage.setItem('arcacon_enabled', JSON.stringify(conPackages.keys()));
  }
});

// 아카콘 클릭
document.getElementById('conWrap').addEventListener('click', async (e) => {
  // 클릭된 요소가 .thumbnail인지 확인
  const groupEl = e.target.closest('.package-wrap');
  const groupId = groupEl ? groupEl.getAttribute('data-package-id') : null;
  const thumbnail = e.target.closest('.thumbnail');
  const conId = thumbnail ? thumbnail.getAttribute('data-id') : null;

  if (conId) {
    console.log('clicked id', conId);
    if (comboState) {
      addCombocon(groupId, conId, thumbnail.cloneNode(true));
    } else {
      sendActivity('recordEmoticon', {
        emoticonId: groupId,
        attachmentId: conId,
      });
    }
  }
});

// 데이터 수집해서 indexedDB에 저장
document.getElementById('resourceCollect').addEventListener('click', () => {
  sendActivity('resourceCollect')
    .then((res) => {
      console.log(res);
      if (res.status !== 'ok') {
        notify('데이터 수집 실패', 'danger');
      } else {
        Promise.all(
          res.data.map(async (item) => {
            item.image = await downloadAndBase64(item.image);
            item.video = await downloadAndBase64(item.video);
            return item;
          })
        ).then((results) => {
          db.emoticon
            .bulkPut(results)
            .then(() => {
              notify('데이터 수집 완료. 확장 프로그램을 닫고 열어주세요.');
            })
            .catch((err) => {
              notify(err, 'danger');
            });
        });
      }
    })
    .catch((err) => {
      console.log(err);
      return { status: 'error', message: err };
    });
});

document.getElementById('listModify').addEventListener('click', () => {
  chrome.tabs.update({ url: 'https://arca.live/settings/emoticons' });
});

if (packageL) {
  if (customSort) {
    (async () => {
      for (const pId of customSort) {
        showConPackage(pId, packageL[pId].title);
      }
    })();
  } else {
    (async () => {
      for (const pId of Object.keys(packageL)) {
        showConPackage(pId, packageL[pId].title);
      }
    })();
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    // 정렬될 정보
    case 'orderUpdated':
      const { enabled, disabled, expired } = JSON.parse(msg.data);
      localStorage.setItem('arcacon_enabled', JSON.stringify(enabled));
      localStorage.setItem('arcacon_disabled', JSON.stringify(disabled));
      localStorage.setItem('arcacon_expired', JSON.stringify(expired));
      break;
    default:
      alert('Unknown action:', msg.action);
  }
});

conListup();
