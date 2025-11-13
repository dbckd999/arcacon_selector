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

async function downloadResource(url) {
  if (url === null) return null;

  const res = await fetch(url);

  const type = res.headers.get('Content-Type') || '';
  if (!type.startsWith('image/') && !type.startsWith('video/'))
    throw new Error(`Unsupported type: ${type}`);

  const b = await res.blob();
  const buff = await b.arrayBuffer();

  return { type: type, source: buff };
  // const b = await res.blob();
  // return await new Promise((resolve) => {
  //   const reader = new FileReader();
  //   reader.onload = (e) => resolve(e.target.result);
  //   reader.readAsDataURL(b);
  // });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.action) {
      // 콘 목록 읽기-전송
      case 'conListUpdate':
        let _gc = document.querySelectorAll('div.package-item');
        const gc = Array.from(_gc).slice(1);
        if (gc.length === 0) {
          sendResponse({ status: 'fail', message: "아카콘을 찾을 수 없습니다."});
          return;
        }
        else {
          const res = {};
          gc.map((el) => {
            subEl = el.querySelector('div');
            res[Number(el.getAttribute('data-package-id'))] = {
              packageName: el.getAttribute('data-package-name'),
              title: el.getAttribute('title'),
              expires: Number(
                subEl.getAttribute('style').match(/expires=(\d+)/)[1]
              ), // expires
            };
          });
          await chrome.storage.local.set({ arcacon_package: res });

          const { arcacon_enabled:enabledList } = await chrome.storage.local.get('arcacon_enabled');
          if (enabledList === undefined) enabledList = Object.keys(res).map(Number);

          await chrome.storage.local.set({ arcacon_enabled: enabledList });

          // 아카콘 대표 이미지
          const resourceHeader = document.querySelectorAll('div.package-thumbnail');
          const result = Array.from(resourceHeader).slice(1).map(async (el) => {
            let origin = 'https:' + el.getAttribute('style').replace(/background-image: url\(\"/g, '').replace(/\"\);$/g, '');
            const { type, source } = await downloadResource(origin);
            // return {
            //   packageId: el.getAttribute('data-package-id'),
            //   [type.split('/')[0]]: source,
            //   type: type,
            // };
            return {
              packageId: el.getAttribute('data-package-id'),
              origin: origin,
            };
          });
          const resultAll = await Promise.all(result);
          sendResponse({ status: 'ok', message: "목록을 저장했습니다.", headCons: resultAll});
        }
        break;
      // 콘 게시
      case 'recordEmoticon':
        console.log(msg.data.emoticonId, msg.data.attachmentId);
        repleCon(msg.data.emoticonId, msg.data.attachmentId);
        sendResponse({ status: 'ok' });
        break;
      case 'recordCombocon':
        repleComboCon(msg.data);
        sendResponse({ status: 'ok' });
        break;
      default:
        const errorMessage = `Unknown action: ${msg.action}`;
        console.error(errorMessage);
        sendResponse({ status: 'error', message: errorMessage });
        break;
    }
  })();
  return true; // 비동기 응답을 위해 true를 반환합니다.
});
