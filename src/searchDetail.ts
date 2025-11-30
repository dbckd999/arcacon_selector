// 검색할 정보들
import ArcaconTagSearch from './panel/search';
import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';
import db from './database';

// 검색과 관련되는 상호작용

// 검색결과 이벤트. 결과는 작성 가능한 이미지 엘리먼트
const searchResult = document.getElementById('searchResult');
if (!searchResult) {
  throw new Error('searchResult element not found');
}

const searchTest = new ArcaconTagSearch(searchResult);
searchResult.addEventListener('onSearch', async (event: Event) => {
  const searchResultEl = document.querySelector('#searchResult .images-container');
  const e = event as CustomEvent<number[]>;
  if (searchResult) {
    searchResultEl.innerHTML = '';

    const conIds = e.detail;
    db.emoticon.bulkGet(conIds).then((cons) => {
      cons.forEach((con) => {
        const thumbnail = document.createElement('img');
        thumbnail.setAttribute('loading', 'lazy');
        thumbnail.setAttribute('class', 'thumbnail');
        thumbnail.src = URL.createObjectURL(con.image);
        thumbnail.setAttribute('data-id', con.conId.toString());
        searchResultEl.append(thumbnail);
      });
    });
  }
});

// 단일태그 클릭-삭제 이벤트
const tagGroup = document.querySelector('.tags-removable');
tagGroup.addEventListener('sl-remove', (event) => {
  const tagClearElement = event.target as HTMLElement;
  const tagData = tagClearElement.getAttribute('data-tag');
  searchTest.remove(tagData);
  tagClearElement.style.opacity = '0';

  tagClearElement.remove();
});

// 생성한 태그 전부 삭제
document.getElementById('removeAllTag').addEventListener('click', (e) => {
  const tagEls = document.querySelectorAll('.tags-removable sl-tag');
  tagEls.forEach((tag) => {
    tag.remove();
  });
  searchTest.clear();
});

// 삭제 가능한 태그객체 생성
const tagGround = document.querySelector('.tags-removable');
const tagInputForm = document.getElementById('tagInput');
tagInputForm.addEventListener('submit', (e: SubmitEvent) => {
  // 이벤트 타입 명시
  e.preventDefault();

  const form = e.target as HTMLFormElement;
  const formData: { [key: string]: string } = serialize(form) as {
    tag: string;
  };

  if (formData.tag.trim() === '') return; // 이제 formData.tag는 string으로 안전하게 접근 가능

  const tagInputValues = formData.tag.split(' ').filter((t) => t.length > 0); // tagInput 대신 tagInputValues로 변수명 변경 및 빈 문자열 필터링
  if (tagInputValues.length === 0) return;

  const slInput = form.querySelector<HTMLInputElement>('sl-input');
  if (slInput) slInput.value = '';

  // 배열(또는 길이가1인) 순회, 태그 추가
  tagInputValues.forEach((t) => {
    searchTest.add(t);
    const tagEl = document.createElement('sl-tag');
    tagEl.setAttribute('data-tag', t);
    tagEl.setAttribute('size', 'small');
    tagEl.setAttribute('removable', 'true');
    tagEl.textContent = t;
    tagGroup?.append(tagEl);
  });
});
