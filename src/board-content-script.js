async function repleCon(emoticonId, attachmentId) {
  const csrf = document
    .querySelector('form#commentForm input[name="_csrf"]')
    .getAttribute('value');

  const url = new URL(window.location.href);
  const res = await fetch(url.origin + url.pathname + '/comment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: new URLSearchParams({
      _csrf: csrf,
      contentType: 'emoticon',
      emoticonId,
      attachmentId,
    }).toString(),
    mode: 'cors',
    credentials: 'include',
    cache: 'no-cache',
  });
  if(res.ok){
    setTimeout(
      () => document.querySelector('a.newcomment-alert').click(),
      1000
    );
  }
}

async function repleComboCon(combolist) {
  if (combolist.length === 0) {
    return;
  }
  // combolist = combolist.map(String);
  const csrf = document
    .querySelector('form#commentForm input[name="_csrf"]')
    .getAttribute('value');

  const url = new URL(window.location.href);
  const commentRes = await fetch(url.origin + url.pathname + '/comment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: new URLSearchParams({
      _csrf: csrf,
      contentType: 'combo_emoticon',
      'option-combo-emoticon': 'on',
      combolist: JSON.stringify(combolist),
      content: '',
    }).toString(),
    mode: 'cors',
    credentials: 'include',
    cache: 'no-cache',
  });

  if(commentRes.ok){
    setTimeout(() => {
      document.querySelector('a.newcomment-alert').click();
    }, 1000);
  }
}

// 페이지에서 직접 요청 -> 확장에서 버튼눌러서 요청
function createSaveButton(){
  const button = document.createElement("button");
  button.addEventListener('click', saveArcacons);
  button.id = 'save-arcacons';
  button.className = "btn-namlacon";
  button.type = "button";
  button.tabIndex = 104;
  button.style = `
    padding: 0 .5em;
    display: flex;
    align-items: center;
    background-color: rgba(0, 0, 0, 0);
    border: none;
    border-radius: 4px;
    color: var(--color-text);
    transition-duration: .3s;
  `
  const icon = document.createElement("span");
  icon.className = "ion-archive";
  icon.style.marginRight = ".1em";
  icon.style.fontSize = "1.4em";

  const text = document.createElement("span");
  text.className = "text";
  text.textContent = "아카콘 목록 저장";

  button.appendChild(icon);
  button.appendChild(text);

  return button;
}

document.querySelector('div.reply-form-button-container').prepend(createSaveButton());

async function saveArcacons() {
  const _gc = document.querySelectorAll('div.package-item');
  const gc = Array.from(_gc).slice(1);
  if (gc.length === 0) {
    alert("아카콘을 목록을 열어주세요.");
    return;
  }
  else {
    const res = {};
    gc.map((el) => {
      const subEl = el.querySelector('div');
      res[Number(el.getAttribute('data-package-id'))] = {
        packageName: el.getAttribute('data-package-name'),
        title: el.getAttribute('title'),
        expires: Number(subEl.getAttribute('style').match(/expires=(\d+)/)[1]),
      };
    });
    await chrome.storage.local.set({ arcacon_package: res });
    const enabledList = gc.map((e)=>{return Number(e.getAttribute('data-package-id'))});
    await chrome.storage.local.set({ arcacon_enabled: enabledList });

    // 아카콘 대표 이미지
    const resourceHeader = document.querySelectorAll('div.package-thumbnail');
    const result = Array.from(resourceHeader).slice(1).map((el) => {
      const origin = 'https:' + el.getAttribute('style').replace(/background-image: url\(\"/g, '').replace(/\"\);$/g, '');
      return {
        packageId: Number(el.getAttribute('data-package-id')),
        url: origin,
      };
    });

    const req = await chrome.runtime.sendMessage({ action: 'saveHeadArcacons', data: result });
    if(req.status === 'ok'){
      alert('아카콘 목록을 저장했습니다.');
    } else {
      alert(req.message);
    }
    
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.action) {
      // 콘 게시
      case 'recordEmoticon':
        console.log(msg.data.emoticonId, msg.data.attachmentId);
        repleCon(msg.data.emoticonId, msg.data.attachmentId);
        sendResponse({ status: 'ok' });
        break;
      // 콤보콘 게시
      case 'recordCombocon':
        repleComboCon(msg.data);
        sendResponse({ status: 'ok' });
        break;
    }
  return true; // 비동기 응답을 위해 true를 반환합니다.
});
