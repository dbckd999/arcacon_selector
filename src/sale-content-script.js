'use strict';

import './conMod.css';

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

const tagApplyBtn = document.createElement('button');
tagApplyBtn.setAttribute('type', 'button');
tagApplyBtn.classList = 'btn btn-arca';
tagApplyBtn.textContent = '태그 적용하기';
tagApplyBtn.addEventListener('click', () => {
  conForm.requestSubmit();
});

const collectDataBtn = document.createElement('button');
collectDataBtn.setAttribute('type', 'button');
collectDataBtn.textContent = '데이터 수집하기';
collectDataBtn.classList = 'btn btn-arca';
collectDataBtn.addEventListener('click', async () => {
  const resources = document.querySelectorAll('div.emoticons-wrapper .emoticon');
  const url = new URL(window.location.href);
  const packageId = Number(url.pathname.replace('/e/', ''));
  
  const elements = Array.from(resources).map((el, idx) => ({
    conId: Number(el.getAttribute('data-id')),
    packageId: packageId,
    conOrder: idx,
    image: 'https:' + el.getAttribute(el.tagName === 'IMG' ? 'src' : 'poster'),
    video: el.hasAttribute('data-src')? 'https:' + el.getAttribute('data-src') : null,
  }));

  chrome.runtime.sendMessage({ 
    action: 'resourceCollect', 
    data: elements
  });
});


document
  .querySelector('div.article-body.emoticon-body div.btns')
  .prepend(tagApplyBtn);
document
  .querySelector('div.article-body.emoticon-body div.btns')
  .prepend(collectDataBtn);

function appendTagInput(dataId, tag){
  const inputEl =   document.createElement('input');
  inputEl.className = 'testi';
  inputEl.value = tag;
  inputEl.name = `emoticon[${dataId}][]`;
  return inputEl;
}

conForm.addEventListener('submit', async (event) => {
  // 폼의 기본 제출 동작(페이지 이동)을 막습니다.
  event.preventDefault();

  const formData = new FormData(conForm);
  console.log(formData.keys());
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
  
  const url = new URL(window.location.href);
  const packageId = Number(url.pathname.replace('/e/', ''));
  const mapped = [];
  console.log(jsonData);
  for (const key of Object.keys(jsonData)) {
    mapped.push({
      packageId: packageId,
      conId: Number(key),
      tags: jsonData[key]
    });
  }

  chrome.runtime.sendMessage({action: 'updateTags', data: mapped});

  // const res = await fetch(conForm.action, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify(jsonData),
  // });
  // if(res.ok){
  //   const data = await res.json();
  //   try{
  //     console.log('Success:', data);
  //   } catch (error) {
  //     console.error('Error:', error);
  //   }
  // }
});

// 1. 원본 이모티콘(video, img)들을 먼저 선택합니다.
//    이 시점에는 아직 .testd 요소가 존재하지 않습니다.

// 2. 각 이모티콘을 순회하며 새로운 wrapper(.testd)로 감싸줍니다.
const packageId = new URL(window.location.href).pathname.replace('/e/', '');
chrome.runtime.sendMessage(
  {
    action: 'getTags',
    data: Number(packageId)
  }).then((response) => {
    const tags = response.data[packageId];

    const emoticons = document.querySelectorAll('div.emoticons-wrapper *');
    emoticons.forEach((emoticon) => {
      const conWarpper = document.createElement('div');
      conWarpper.setAttribute('class', 'testd');

      const tagWrapper = document.createElement('div');
      tagWrapper.classList = 'tagWrapper';

      const dataId = emoticon.getAttribute('data-id');
      if (tags[dataId]) {
        for (const tag of tags[dataId]) {
          const conTag = document.createElement('input');
          conTag.className = 'testi';
          conTag.value = tag;
          conTag.name = `emoticon[${dataId}][]`;
          tagWrapper.appendChild(conTag);
        };
      }

      const addButton = document.createElement('button');
      addButton.setAttribute('type', 'button');
      addButton.classList = 'add-tag-toggle-btn';
      addButton.textContent = '+';

      conWarpper.appendChild(emoticon);
      conWarpper.appendChild(tagWrapper);
      conWarpper.appendChild(addButton);
      wrapper.appendChild(conWarpper);
    });
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

    const tagInputEl = appendTagInput(dataId, null);
    conWrapper.querySelector('div.tagWrapper').append(tagInputEl);
  });