
// 검색할 정보들
import ArcaconTagSearch from './search'
import { serialize } from '@shoelace-style/shoelace/dist/utilities/form.js';
import { IEmoticon } from './database';

// 검색결과 이벤트. 결과는 작성 가능한 이미지 엘리먼트
const searchResult = document.getElementById('searchResult');
if (!searchResult) {
  throw new Error('searchResult element not found');
}

const searchTest = new ArcaconTagSearch(searchResult);
searchResult.addEventListener('onSearch', (event: Event) => {
  const e = event as CustomEvent<IEmoticon[]>;
  if (searchResult) {
    searchResult.innerHTML = '<span>검색결과</span><br>';

    e.detail.forEach(con => {
      if (con.image) {
        const thumbnail = document.createElement('img');
        thumbnail.setAttribute('loading', 'lazy');
        thumbnail.setAttribute('class', 'thumbnail');
        thumbnail.src = URL.createObjectURL(con.image);
        thumbnail.setAttribute('data-id', con.conId.toString());
        searchResult.append(thumbnail);
      }
    });
  }
});

// 단일태그 클릭-삭제 이벤트
const tagGroup = document.querySelector('.tags-removable');
tagGroup.addEventListener('sl-remove', (event) => {
  const tagClearElement = event.target as HTMLElement;;
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
tagInputForm.addEventListener('submit', (e: SubmitEvent) => { // 이벤트 타입 명시
    e.preventDefault();
    const form = e.target as HTMLFormElement; // e.target을 HTMLFormElement로 캐스팅
    const formData = serialize(form) as { tag: string }; // serialize 결과 타입을 명시

    if (formData.tag.trim() === '') return; // 이제 formData.tag는 string으로 안전하게 접근 가능

    const tagInputValues = formData.tag.split(' ').filter(t => t.length > 0); // tagInput 대신 tagInputValues로 변수명 변경 및 빈 문자열 필터링
    if (tagInputValues.length === 0) return;

    const slInput = form.querySelector('sl-input'); // sl-input 요소에 접근
    if (slInput) slInput.value = ''; // sl-input이 null일 수 있으므로 null 체크 후 value 설정

    tagInputValues.forEach(t => { // while 루프 대신 forEach 사용
        searchTest.add(t);
        const tagEl = document.createElement('sl-tag'); // SlTag 타입 명시
        tagEl.setAttribute('data-tag', t);
        tagEl.size = 'small'; // setAttribute 대신 직접 속성 접근
        tagEl.removable = true; // setAttribute 대신 직접 속성 접근
        tagEl.textContent = t; // innerHTML 대신 textContent 사용
        tagGroup?.append(tagEl); // tagGroup이 null일 수 있으므로 옵셔널 체이닝 사용
    });
});