'use strict';

import '../css/conMod.css';

// 테그 전송
function createTagFromElement() {
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

  // 데이터 전송
  conForm.addEventListener('submit', async (event) => {
    // 폼의 기본 제출 동작(페이지 이동)을 막습니다.
    event.preventDefault();

    const formData = new FormData(conForm);
    console.log(formData.keys());
    const jsonData = {};
    // 키: 콘ID, 값: [태그...]

    // FormData를 순회하며 JSON 객체를 만듭니다.
    for (const [key, value] of formData.entries()) {
      // key 형식: emoticon[dataId][] 또는 dataId.[]
      // const match = key.match(/\[(\d+)\]/);
      // const dataID = match ? match[1] : key.replace('.[]', '');

      const _value = value.trim();
      if (_value === '') continue;

      if (!(key in jsonData)) {
        jsonData[key] = {};
        jsonData[key]['tags'] = new Set();
        jsonData[key]['chosung'] = new Set();
      }

      // 초성 데이터로 변환 가능하면 추가로 저장
      jsonData[key]['tags'].add(_value);
      const chungValue = getChosung(_value);
      if (chungValue !== _value) {
        jsonData[key]['chosung'].add(chungValue);
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
        tags: Array.from(jsonData[key]['tags']),
        chosung: Array.from(jsonData[key]['chosung']),
      });
    }

    // 헤더 아이콘 태그 가져오기
    const headFormData = new FormData(document.getElementById('headID'));
    // FormData를 순회하며 JSON 객체를 만듭니다.
    const headData = [];
    for (const [key, value] of headFormData.entries()) {
      if (value.trim() === '') continue;
      headData.push(value.trim());
    }

    const { status, message } = await chrome.runtime.sendMessage({
      action: 'updateTags',
      data: mapped,
      head: headData,
      packageId: packageId,
    });
    if (status === 'ok') {
      alert(message);
    } else {
      alert(message);
    }
  });

  document
    .querySelector('div.article-body.emoticon-body div.btns')
    .prepend(tagApplyBtn);

  // return tagApplyBtn;
}
createTagFromElement();

// 이미지데이터 수집 버튼
function createCollectElement() {
  const collectDataBtn = document.createElement('button');
  collectDataBtn.setAttribute('type', 'button');
  collectDataBtn.textContent = '데이터 수집하기';
  collectDataBtn.classList = 'btn btn-arca';
  collectDataBtn.addEventListener('click', async () => {
    const resources = document.querySelectorAll(
      'div.emoticons-wrapper .emoticon'
    );
    const url = new URL(window.location.href);
    const packageId = Number(url.pathname.replace('/e/', ''));

    const elements = Array.from(resources).map((el, idx) => ({
      conId: Number(el.getAttribute('data-id')),
      packageId: packageId,
      conOrder: idx,
      image:
        'https:' + el.getAttribute(el.tagName === 'IMG' ? 'src' : 'poster'),
      video: el.hasAttribute('data-src')
        ? 'https:' + el.getAttribute('data-src')
        : null,
    }));

    chrome.runtime
      .sendMessage({
        action: 'resourceCollect',
        data: elements,
        packageId: packageId,
      })
      .then((response) => {
        if (response.status === 'ok') {
          alert('데이터 수집이 완료되었습니다.');
        } else {
          alert(response.message);
        }
      });
  });

  document
    .querySelector('div.article-body.emoticon-body div.btns')
    .prepend(collectDataBtn);

  // return collectDataBtn;
}
createCollectElement();

// 콘 공통 태그
function createHeadTagElement() {
  // 아카콘 헤더 태그
  const headerForm = document.createElement('form');
  headerForm.id = 'headID';
  headerForm.setAttribute('action', '#');

  const headerTagBase = document.createElement('div');
  headerTagBase.append(headerForm);
  const headerBtn = document.createElement('button');
  headerBtn.textContent = '+';
  headerBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const headTagInput = document.createElement('input');
    headTagInput.name = 'head';
    headerForm.append(headTagInput);
  });
  headerTagBase.append(headerBtn);

  document.querySelector('div.emoticon-header').after(headerTagBase);

  // return headerForm;
}
createHeadTagElement();

function createTagInput(dataId, tag) {
  const inputEl = document.createElement('input');
  inputEl.className = 'testi';
  inputEl.value = tag;
  inputEl.name = `emoticon[${dataId}][]`;
  return inputEl;
}

// 문장 초성으로
function getChosung(str) {
  const CHOSUNG_LIST = [
    'ㄱ',
    'ㄲ',
    'ㄴ',
    'ㄷ',
    'ㄸ',
    'ㄹ',
    'ㅁ',
    'ㅂ',
    'ㅃ',
    'ㅅ',
    'ㅆ',
    'ㅇ',
    'ㅈ',
    'ㅉ',
    'ㅊ',
    'ㅋ',
    'ㅌ',
    'ㅍ',
    'ㅎ',
  ];

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);

    // 한글 음절(가-힣) 범위 체크
    if (charCode >= 0xac00 && charCode <= 0xd7a3) {
      const chosungIndex = Math.floor((charCode - 0xac00) / (21 * 28));
      result += CHOSUNG_LIST[chosungIndex];
    } else {
      // 한글이 아니면 원본 문자 그대로 추가
      result += str.charAt(i);
    }
  }
  return result;
}

const packageId = new URL(window.location.href).pathname.replace('/e/', '');

// 태그 추가하기
function addTagData(conElement, tags) {}

// 태그 가져오기
// 여기선 데이터만 관여하고, 엘리먼트 변경은 따로하자.
chrome.runtime
  .sendMessage({
    action: 'getTags',
    data: Number(packageId),
  })
  .then((response) => {
    const tags = response.data[packageId] || [];
    const headTags = response.head.tags || [];

    // Object.keys(response.data[packageId]).forEach(key => {
    //   addTagData(tags[key], tag.dataId);
    // });

    const emoticons = document.querySelectorAll('div.emoticons-wrapper *');
    const wrapper = document.querySelector('div.emoticons-wrapper');
    emoticons.forEach((emoticon) => {
      // addTagData(emoticon, tags[emoticon.getAttribute('data-id')]);
      const conWarpper = document.createElement('div');
      conWarpper.setAttribute('class', 'conWarpper');

      const tagWrapper = document.createElement('div');
      tagWrapper.classList = 'tagWrapper';

      const dataId = emoticon.getAttribute('data-id');
      if (tags[dataId]) {
        for (const tag of tags[dataId]) {
          const conTag = document.createElement('input');
          conTag.className = 'testi';
          conTag.value = tag;
          conTag.name = dataId;
          tagWrapper.appendChild(conTag);
        }
      }

      const addButton = document.createElement('button');
      addButton.setAttribute('type', 'button');
      addButton.classList = 'add-tag';
      addButton.textContent = '+';

      conWarpper.appendChild(emoticon);
      conWarpper.appendChild(tagWrapper);
      conWarpper.appendChild(addButton);
      wrapper.appendChild(conWarpper);
    });

    const headerForm = document.getElementById('headID');
    headTags.forEach((tag) => {
      const headTagInput = document.createElement('input');
      headTagInput.name = 'head';
      headTagInput.value = tag;

      headerForm.append(headTagInput);
    });
  });

document
  .querySelector('div.emoticons-wrapper')
  .addEventListener('click', (event) => {
    const btn = event.target.closest('.add-tag');
    if (!btn) return;

    const conWrapper = btn.closest('.conWarpper');
    if (!conWrapper) return;

    const dataId = conWrapper
      .querySelector('.emoticon')
      .getAttribute('data-id');

    const tagInputEl = createTagInput(dataId, null);
    conWrapper.querySelector('div.tagWrapper').append(tagInputEl);
  });
