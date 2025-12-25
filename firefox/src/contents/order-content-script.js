const orderApplyBtn = document.querySelector(
  'article.containe-fluid.board-article form div.btns button'
);

const enabledEmoticon = document.querySelector(
  'table[data-action-role="emoticons.enabled"]'
);

orderApplyBtn.addEventListener('click', () => {
  const enabled = Array.from(enabledEmoticon.querySelectorAll('input'), (e) =>
    Number(e.value)
  );

  console.log('Enabled:', enabled);

  // 수집한 데이터 설정
  browser.storage.local.set({
    arcacon_enabled: enabled,
  });

  // 패키지데이터 갱신
  browser.storage.local.get('arcacon_package').then((res) => {
    const origin = res.arcacon_package || {};

    Object.keys(origin).forEach((key) => {
      origin[key].available = false;
    });
    enabled.forEach((enable) => {
      if (enable in origin) {
        origin[enable].available = true;
      } else {
        origin[enable] = {
          packageName: '데이터 없음(ID:' + String(enable) + ')',
          title: '데이터 없음(ID:' + String(enable) + ')',
          visible: true,
          available: true,
        };
      }
    });

    browser.storage.local.set({ arcacon_package: origin });
  });
});
