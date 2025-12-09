import db from '../database';
import { notify } from '../util/notify';

import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Korean from '@uppy/locales/lib/ko_KR.js';

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

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

const upy = new Uppy({
  restrictions: {
    allowedFileTypes: ['.json'],
  },
}).use(Dashboard, {
  inline: true,
  target: '#uppy-dashboard',
  locale: Korean,
  theme: 'dark',
  note: 'JSON파일만 업로드 가능합니다.',
});

upy.on('file-added', async (file) => {
  try {
    const text = await file.data.text(); // Blob → text
    const json = JSON.parse(text);

    // 간단 검증 예시
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON structure');
    }
  } catch (e) {
    notify('유효하지 않은 JSON 파일입니다.', 'exclamation-triangle');
    upy.removeFile(file.id); // 잘못된 파일 제거
  }
});

upy.on('upload', async (uploadID, files) => {
  let count = 0;
  for(const file of files){
    const text = await file.data.text();
    const json = JSON.parse(text);

    const { packageID, headerTag, atLocal, emoticon } = json;
    //1. 로컬스토리지 업데이트
    const heads = (await chrome.storage.local.get('arcacon_package')).arcacon_package || {};
    heads[packageID] = {
      packageName: atLocal.packageName,
      title: atLocal.title,
      visible: true,
      available: true,
    };
    chrome.storage.local.set({arcacon_package: heads});

    // bulkUpdate 데이터 생성
    const modEmoticons = emoticon.map((e) => {
      // 초성데이터 추가
      const chosung = [];
      e.tags.forEach((tag) => {
        const nowChosung = getChosung(tag);
        if(tag !== nowChosung) chosung.push(nowChosung);
      });
      return {
        key: e.conId,
        changes: {
          tags: e.tags,
          chosung: chosung,
        }
      }
    });

    // indexedDB
    // 다운받은 데이터 존재 확인. 없으면 경고.
    if(db.package_info.get(Number(packageID))){
      // 2. 패키지 공통태그
      await db.package_info.update(Number(packageID), { tags: headerTag });
      // 3. 단일 아카콘 태그
      await db.emoticon.bulkUpdate(modEmoticons);
      console.log(`${atLocal.packageName}(${packageID}) 태그 업데이트 완료`);
      ++count;
    } else {
      notify(`${atLocal.packageName}(${packageID}) 태그 무시됨`, 'danger');
      console.error(e);
    }
  };
  notify(`${count}개의 아카콘 데이터를 업데이트했습니다.`);
  chrome.runtime.sendMessage({ action: 'indexUpdate' });
});
