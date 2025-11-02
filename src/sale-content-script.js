'use strict';

import './conMod.css';

const tags_debug = {
  257785434: ['난딸이잖아', '슈로'],
  258192035: ['모라는거야', '슈로'],
};

const tagApplyBtn = document.createElement('button');
tagApplyBtn.setAttribute('type', 'button');
tagApplyBtn.classList = 'btn btn-arca';
tagApplyBtn.textContent = '콘 태그 적용하기';
document
  .querySelector('div.article-body.emoticon-body div.btns')
  .prepend(tagApplyBtn);

// 테그 데이터 불러와서 웹에 띄우기
// 지금은 더미데이터로 띄우자
const wrapper = document.querySelector('div.emoticons-wrapper');
wrapper.className += ' fortags';

const conForm = document.createElement('form');
conForm.setAttribute('method', 'post');
// conForm.setAttribute('action', 'https://api.dbckd999.xyz/test');
conForm.setAttribute('action', '#');
conForm.appendChild(wrapper);
document.querySelector('div.article-body.emoticon-body').prepend(conForm);

conForm.addEventListener('submit', (event) => {
  // 폼의 기본 제출 동작(페이지 이동)을 막습니다.
  event.preventDefault();
  const formData = new FormData(conForm);
  const jsonData = {};

  // FormData를 순회하며 JSON 객체를 만듭니다.
  for (const [key, value] of formData.entries()) {
    // key 형식: emoticon[dataId][] 또는 dataId.[]
    const match = key.match(/\[(\d+)\]/);
    const dataId = match ? match[1] : key.replace('.[]', '');

    if (!jsonData[dataId]) {
      jsonData[dataId] = [];
    }
    // 빈 태그는 보내지 않습니다.
    if (value.trim() !== '') {
      jsonData[dataId].push(value);
    }
  }

  console.log('Sending JSON data:', jsonData);

  // fetch(conForm.action, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify(jsonData),
  // })
  //   .then((response) => response.json())
  //   .then((data) => console.log('Success:', data))
  //   .catch((error) => console.error('Error:', error));
});

tagApplyBtn.addEventListener('click', () => {
  conForm.requestSubmit();
});

// 1. 원본 이모티콘(video, img)들을 먼저 선택합니다.
//    이 시점에는 아직 .testd 요소가 존재하지 않습니다.
const emoticons = document.querySelectorAll('div.emoticons-wrapper *');

// 2. 각 이모티콘을 순회하며 새로운 wrapper(.testd)로 감싸줍니다.
emoticons.forEach((emoticon) => {
  const conWarpper = document.createElement('div');
  conWarpper.setAttribute('class', 'testd');

  const tagWrapper = document.createElement('div');
  tagWrapper.classList = 'tagWrapper';
  // 전송할 데이터 입력
  const dataId = emoticon.getAttribute('data-id');
  if (tags_debug[dataId]) {
    tags_debug[dataId].forEach((tag) => {
      const conTag = document.createElement('input');
      conTag.className = 'testi';
      conTag.value = tag;
      conTag.name = `emoticon[${dataId}][]`;
      tagWrapper.appendChild(conTag);
    });
  }

  // 누르면 태그 추가
  const addButton = document.createElement('button');
  addButton.setAttribute('type', 'button');
  addButton.classList = 'add-tag-toggle-btn';
  addButton.textContent = '+';

  conWarpper.appendChild(emoticon);
  conWarpper.appendChild(tagWrapper);
  conWarpper.appendChild(addButton);
  wrapper.appendChild(conWarpper);
});

document
  .querySelector('div.emoticons-wrapper')
  .addEventListener('click', (event) => {
    const btn = event.target.closest('.add-tag-toggle-btn');
    if (!btn) return;

    const conWrapper = btn.closest('.testd');
    if (!conWrapper) return;

    const dataId = conWrapper
      .querySelector('.emoticon')
      .getAttribute('data-id');
    const conTag = document.createElement('input');
    conTag.className = 'testi';
    conTag.name = `emoticon[${dataId}][]`;

    conWrapper.querySelector('div.tagWrapper').append(conTag);
  });

async function downloadAndBase64(url) {
  if (url === null) {
    return null;
  }
  const res = await fetch(url);
  const b = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(b);
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    // 콘 데이터 수집
    case 'resourceCollect':
      const packageBuyPath = window.location.href;
      const packageId = Number(
        packageBuyPath.match(/\/e\/(\d+)(?=[\/?#]|$)/)[1]
      );

      const els = document.querySelectorAll('div.emoticons-wrapper .emoticon');
      if (els.length === 0) {
        alert('아카콘을 찾을 수 없습니다.');
        break;
      }
      let res = Array.from(els).map((el, idx) => ({
        conId: Number(el.getAttribute('data-id')),
        packageId: packageId,
        conOrder: idx,
        image: el.getAttribute(el.tagName === 'IMG' ? 'src' : 'poster'),
        video: el.getAttribute(el.tagName === 'VIDEO' ? 'data-src' : null),
      }));
      sendResponse({ status: 'ok', data: res });
      break;
    default:
      alert('Unknown action:', msg.action);
  }
});
