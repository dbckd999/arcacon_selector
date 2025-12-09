const orderApplyBtn = document.querySelector(
  'body > div.root-container > div.content-wrapper.clearfix > article > div > form > div.btns > button'
);

const enabledEmoticon = document.querySelector(
  'table[data-action-role="emoticons.enabled"]'
);
// const disabledEmoticon = document.querySelector(
//   'table[data-action-role="emoticons.disabled"]'
// );
// const expiredEmoticon = document.querySelector(
//   'table[data-action-role="emoticons.expired"]'
// );

orderApplyBtn.addEventListener('click', () => {
  const enabled = Array.from(enabledEmoticon.querySelectorAll('input'), (e) =>
    Number(e.value)
  );
  // const disabled = Array.from(disabledEmoticon.querySelectorAll('input'), (e) =>
  //   Number(e.value)
  // );
  // const expired = Array.from(expiredEmoticon.querySelectorAll('input'), (e) =>
  //   Number(e.value)
  // );

  console.log('Enabled:', enabled);
  // console.log('Disabled:', disabled);
  // console.log('Expired:', expired);

  // 수집한 데이터 설정
  // TODO arcacon_enabled대신 arcacon_package.available 사용
  chrome.storage.local.set({
    arcacon_enabled: enabled,
    // arcacon_disabled: disabled,
    // arcacon_expired: expired,
  });

  chrome.storage.local.get('arcacon_package')
  .then((res) => {
    const origin = res.arcacon_package;

    Object.keys(origin).forEach((key) => {
      origin[key].available = false;
    });
    enabled.forEach((enable) => {
      if (enable in origin) {
        origin[enable].available = true;
      } else {
        origin[enable] = {
          packageName: '데이터 없음('+String(enable)+')',
          title: '데이터 없음',
          visible: true,
          available: true,
        };
      }
    });

    chrome.storage.local.set({'arcacon_package': origin });
  });
    
});
