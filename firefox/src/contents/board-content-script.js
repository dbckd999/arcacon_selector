import '../css/board-content-script.css';

/**
 * 지정된 시간 동안 주기적으로 selector에 해당하는 엘리먼트를 찾습니다.
 * 엘리먼트를 찾으면 Promise를 통해 해당 엘리먼트를 반환합니다.
 * @param {string} selector - 찾을 엘리먼트의 CSS selector.
 * @param {number} timeout - 최대 대기 시간 (ms). 기본값 5000ms (5초).
 * @param {number} interval - 탐색 주기 (ms). 기본값 200ms.
 * @returns {Promise<Element>} 찾은 엘리먼트. 시간 초과 시 Promise는 reject됩니다.
 */
function waitForElement(selector, timeout = 5000, interval = 200) {
  return new Promise((resolve, reject) => {
    let elapsedTime = 0;
    const timer = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(timer);
        resolve(element);
      } else {
        elapsedTime += interval;
        if (elapsedTime >= timeout) {
          clearInterval(timer);
          reject(
            new Error(
              `'${selector}' 엘리먼트를 ${timeout}ms 내에 찾지 못했습니다.`
            )
          );
        }
      }
    }, interval);
  });
}

async function repleCon(emoticonId, attachmentId) {
  const csrf = document
    .querySelector('form#commentForm input[name="_csrf"]')
    .getAttribute('value');

  const url = new URL(window.location.href);
  const cmtURL = url.origin + url.pathname + '/comment';
  const urlParamInit = {
    _csrf: csrf,
    contentType: 'emoticon',
    emoticonId,
    attachmentId,
  };
  if (cmtSelected !== '') urlParamInit.parentId = cmtSelected;
  const fetchInput = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: new URLSearchParams(urlParamInit).toString(),
    mode: 'cors',
    credentials: 'include',
    cache: 'no-cache',
  };

  try {
    const commentRes = await fetch(cmtURL, fetchInput);
    if (commentRes.ok) {
      const clickEl = await waitForElement('a.newcomment-alert');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      clickEl.click();
      return true;
    }
  } catch (error) {
    console.warn(error.message); // 엘리먼트를 못 찾아도 에러 대신 경고만 출력
    return false;
  }
}

async function repleComboCon(combolist) {
  if (combolist.length === 0) return;
  const csrf = document
    .querySelector('form#commentForm input[name="_csrf"]')
    .getAttribute('value');

  const url = new URL(window.location.href);
  const cmtURL = url.origin + url.pathname + '/comment';
  const bodyInit = {
    _csrf: csrf,
    contentType: 'combo_emoticon',
    'option-combo-emoticon': 'on',
    combolist: JSON.stringify(combolist),
    content: '',
  };
  if (cmtSelected !== '') bodyInit.parentId = cmtSelected;
  const fetchInput = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: new URLSearchParams(bodyInit).toString(),
    mode: 'cors',
    credentials: 'include',
    cache: 'no-cache',
  };

  try {
    const commentRes = await fetch(cmtURL, fetchInput);
    if (commentRes.ok) {
      const clickEl = await waitForElement('a.newcomment-alert');
      setTimeout(() => {
        clickEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        clickEl.click();
        return true;
      }, 1000);
    }
  } catch (error) {
    console.warn(error.message); // 엘리먼트를 못 찾아도 에러 대신 경고만 출력
    return false;
  }
}

// 페이지에서 직접 콘 목록 요청
function createSaveButton() {
  const button = document.createElement('button');
  button.addEventListener('click', saveArcacons);
  button.id = 'save-arcacons';
  button.className = 'btn-namlacon con-save';
  button.type = 'button';
  button.tabIndex = 104;

  const icon = document.createElement('span');
  icon.className = 'ion-archive';

  const text = document.createElement('span');
  text.className = 'text';
  text.innerHTML = '&nbsp;아카콘 목록 저장';

  button.appendChild(icon);
  button.appendChild(text);

  return button;
}

document
  .querySelector('div.reply-form-button-container')
  .prepend(createSaveButton());

async function saveArcacons() {
  const _gc = document.querySelectorAll('div.package-item');
  const gc = Array.from(_gc).slice(1);
  if (gc.length === 0) {
    alert('아카콘을 목록을 열어주세요.');
    return;
  } else {
    // 기존 모든 콘 정보
    const origin = (await browser.storage.local.get('arcacon_package')).arcacon_package ?? {};
    // 원본 데이터는 우선 visible: false로. 새로운값은 true로 덮어쓰기됨
    for (const key in origin) {
      origin[key].visible = false;
      origin[key].available = false;
    }

    // 새로 받아온 정보
    const res = {};
    const originKeys = Object.keys(origin);
    gc.map((el) => {
      res[Number(el.getAttribute('data-package-id'))] = {
        packageName: el.getAttribute('data-package-name'),
        title: el.getAttribute('title'),
        // visible은 기존값을 가져온다.
        visible: (Number(el.getAttribute('data-package-id')) in originKeys) ? origin[Number(el.getAttribute('data-package-id'))].visible : true,
        available: true
      };
    });
    await browser.storage.local.set({ arcacon_package: Object.assign(origin, res) });

    const enabledList = gc.map((e) => {
      return Number(e.getAttribute('data-package-id'));
    });
    
    // 표시 순서전용
    await browser.storage.local.set({ arcacon_enabled: enabledList });

    // 아카콘 대표 이미지
    const resourceHeader = document.querySelectorAll('div.package-thumbnail');
    const result = Array.from(resourceHeader)
      .slice(1)
      .map((el) => {
        const origin =
          'https:' +
          el
            .getAttribute('style')
            .replace(/background-image: url\(\"/g, '')
            .replace(/\"\);$/g, '');
        return {
          packageId: Number(el.getAttribute('data-package-id')),
          url: origin,
        };
      });

    const req = await browser.runtime.sendMessage({
      action: 'saveHeadArcacons',
      data: result,
    });
    if (req.status === 'ok') {
      alert('아카콘 목록을 저장했습니다.');
    } else {
      alert(req.message);
    }
  }
}

// 댓글/대댓글 위치 선택
// 팝업 스크립트에서 빈 값이면 기본, 있으면 해당 id붙여서 fetch
let cmtSelected = '';
function selectFormSelect() {
  // 초기값 댓글창
  const button = document.createElement('button');
  button.addEventListener('click', () => {
    document.querySelectorAll('.arcacon-focused').forEach((e) => {
      e.classList.remove('arcacon-focused');
    });
    cmtSelected = '';
  });
  button.className = 'btn-namlacon con-save';
  button.type = 'button';
  button.tabIndex = 104;

  const icon = document.createElement('span');
  icon.className = 'ion-chatbox';

  const text = document.createElement('span');
  text.className = 'text';
  text.innerHTML = '&nbsp;답글 선택';

  button.appendChild(icon);
  button.appendChild(text);

  document.querySelector('div.reply-form-button-container').prepend(button);

  // 대댓글 선택을 하려면 답글 옆에 선택 버튼을 만들어 둬야한다.
  const commentRights = document.querySelectorAll('div.comment-item');
  commentRights.forEach((r) => {
    const cmtBtnTarget = r.querySelector('div.right');
    const sep = document.createElement('span');
    sep.className = 'sep';
    cmtBtnTarget.append(sep);

    const dataId = r.querySelector('a.reply-link').getAttribute('data-target');
    const cmtSelect = document.createElement('a');
    cmtSelect.href = '#';
    cmtSelect.className = 'comment-select';
    cmtSelect.setAttribute('data-target', dataId);
    cmtSelect.textContent = '답글 선택';
    cmtSelect.addEventListener('click', (e) => {
      // 선택된 대댓글은 parentId에 id값 추가해서 fetch
      e.preventDefault();
      document.querySelectorAll('.arcacon-focused').forEach((e) => {
        e.classList.remove('arcacon-focused');
      });
      e.target.classList.add('arcacon-focused');
      cmtSelected = e.target.getAttribute('data-target');
    });
    cmtBtnTarget.append(cmtSelect);
  });
}
selectFormSelect();

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    let res = false;
    switch (msg.action) {
      // 콘 게시
      case 'recordEmoticon':
        const { emoticonId, attachmentId } = msg.data;
        console.log('콘 게시', emoticonId, attachmentId);
        res = await repleCon(emoticonId, attachmentId);
        break;
      // 콤보콘 게시
      case 'recordCombocon':
        res = repleComboCon(msg.data);
        break;
    }
    const status = res ? 'ok' : 'fail';
    sendResponse({ status });
  })();
  return true; // 비동기 응답을 위해 true를 반환합니다.
});
