const orderApplyBtn = document.querySelector(
  'body > div.root-container > div.content-wrapper.clearfix > article > div > form > div.btns > button'
);

const enabledEmoticon = document.querySelector(
  'table[data-action-role="emoticons.enabled"]'
);
const disabledEmoticon = document.querySelector(
  'table[data-action-role="emoticons.disabled"]'
);
const expiredEmoticon = document.querySelector(
  'table[data-action-role="emoticons.expired"]'
);

orderApplyBtn.addEventListener('click', () => {
  const enabled = Array.from(enabledEmoticon.querySelectorAll('input'), (e) =>
    Number(e.value)
  );
  const disabled = Array.from(disabledEmoticon.querySelectorAll('input'), (e) =>
    Number(e.value)
  );
  const expired = Array.from(expiredEmoticon.querySelectorAll('input'), (e) =>
    Number(e.value)
  );

  console.log('Enabled:', enabled);
  console.log('Disabled:', disabled);
  console.log('Expired:', expired);

  // 수집한 데이터를 background로 전송합니다.
  chrome.runtime.sendMessage({
    action: 'orderUpdated',
    data: {
      enabled,
      disabled,
      expired,
    },
  });
});
