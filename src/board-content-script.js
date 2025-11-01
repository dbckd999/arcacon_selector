function repleCon(emoticonId, attachmentId) {
  const csrf = document
    .querySelector('form#commentForm input[name="_csrf"]')
    .getAttribute('value');

  fetch(window.location.href + '/comment', {
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
  }).then((res) => {
    // console.log(res);
    setTimeout(
      () => document.querySelector('a.newcomment-alert').click(),
      1000
    );
  });
}

function repleComboCon(combolist) {
  if (combolist.length === 0) {
    return;
  }
  // combolist = combolist.map(String);
  const csrf = document
    .querySelector('form#commentForm input[name="_csrf"]')
    .getAttribute('value');

  fetch(window.location.href + '/comment', {
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
  }).then((res) => {
    // console.log(res);
    setTimeout(() => {
      document.querySelector('a.newcomment-alert').click();
    }, 1000);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    // 콘 목록 읽기-전송
    case 'conLinstUpdate':
      let _gc = document.querySelectorAll('div.package-item');
      const gc = Array.from(_gc).slice(1);
      if (gc.length === 0) alert('아카콘 목록을 열어주세요.');
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
        sendResponse(JSON.stringify(res));
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
      alert('Unknown action:', msg.action);
  }
});
