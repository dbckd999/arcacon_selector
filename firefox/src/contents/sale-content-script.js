'use strict';

import '../../../public/css/conMod.css';

const arcacons =
  (await browser.storage.local.get('arcacon_enabled')).arcacon_enabled ?? [];
const packageId = Number(
  new URL(window.location.href).pathname.replace('/e/', '')
);

// 테그 전송
function createTagFromElement() {
  // 입력 양식 설명
  const info = document.createElement('span');
  info.innerHTML =
    '태그의 최대길이는 20자이며, 각 이모티콘당 5개의 태그를 입력할 수 있습니다. 공백/빈칸인 태그는 무시됩니다.<br>공통 태그를 제외한 이모티콘은 검색을 위해 초성으로 추가로 변환되어 저장됩니다.';
  document.querySelector('div.article-body.emoticon-body form').before(info);

  const wrapper = document.querySelector('div.emoticons-wrapper');
  wrapper.className += ' fortags';
  const conForm = document.createElement('form');
  conForm.setAttribute('method', 'post');
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
    console.log('폼 데이터 키', formData.keys());
    const jsonData = {};
    // 키: 콘ID, 값: [태그...]

    // FormData를 순회하며 JSON 객체를 만듭니다.
    // for (const [key, value] of formData.entries()) {
    formData.forEach((value, key) => {
      // key 형식: emoticon[dataId][] 또는 dataId.[]
      const match = key.match(/\[(\d+)\]/);
      const dataID = match ? match[1] : key.replace('.[]', '');

      const _value = value.trim();
      if (_value !== '') {
        if (!(dataID in jsonData)) {
          jsonData[dataID] = {};
          jsonData[dataID]['tags'] = new Set();
          jsonData[dataID]['chosung'] = new Set();
        }

        // 초성 데이터로 변환 가능하면 추가로 저장
        jsonData[dataID]['tags'].add(_value);
        const chungValue = getChosung(_value);
        if (chungValue !== _value) {
          jsonData[dataID]['chosung'].add(chungValue);
        }
      }
    });
    // }

    const mapped = {};
    console.log('json형태로 변환된 form데이터', jsonData);
    for (const key of Object.keys(jsonData)) {
      mapped[Number(key)] = {
        packageId,
        tags: Array.from(jsonData[key]['tags']),
        chosung: Array.from(jsonData[key]['chosung']),
      };
    }

    // 헤더 아이콘 태그 가져오기
    const headFormData = new FormData(document.getElementById('headID'));
    const headData = [];
    // for (const [key, value] of headFormData.entries()) {
    headFormData.forEach((value, key) => {
      if (value.trim() !== '') headData.push(value.trim());
    });

    const { status, message } = await browser.runtime.sendMessage({
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

    // 헤드 이미지, 패키지 이름
    // 패키지, 헤드 데이터를 갱신
    const head = {
      packageId,
      title: document.querySelector('meta[name=title]').getAttribute('content'),
    };

    browser.runtime
      .sendMessage({
        action: 'resourceCollect',
        data: elements,
        packageId: packageId,
        head,
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

function createTagInput(dataId, tag) {
  const inputEl = document.createElement('input');
  inputEl.className = 'testi';
  inputEl.value = tag;
  inputEl.name = `emoticon[${dataId}][]`;
  inputEl.maxlength = '20';
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

const tagCounts = {};
// 목록에 있는 패키지일때
if (arcacons.includes(Number(packageId))) {
  createTagFromElement();
  createCollectElement();
  createHeadTagElement();

  // 태그 가져오기
  // 여기선 데이터만 관여하고, 엘리먼트 변경은 따로하자.
  browser.runtime
    .sendMessage({
      action: 'getTags',
      data: Number(packageId),
    })
    .then((response) => {
      const tags = response.data[packageId] || [];
      const headTags = response.head.tags || [];

      const emoticons = document.querySelectorAll('div.emoticons-wrapper *');
      const wrapper = document.querySelector('div.emoticons-wrapper');
      emoticons.forEach((emoticon) => {
        const conWarpper = document.createElement('div');
        conWarpper.setAttribute('class', 'conWarpper');

        const tagWrapper = document.createElement('div');
        tagWrapper.classList = 'tagWrapper';

        const dataId = emoticon.getAttribute('data-id');
        if (tags[dataId]) {
          tagCounts[dataId] = tags[dataId].length || 0;
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

      if (tagCounts[dataId] === undefined) tagCounts[dataId] = 0;
      if (tagCounts[dataId] >= 5) {
        alert('5개까지만 가능합니다.');
        return;
      }

      tagCounts[dataId] += 1;
      const tagInputEl = createTagInput(dataId, null);
      conWrapper.querySelector('div.tagWrapper').append(tagInputEl);
    });
}
