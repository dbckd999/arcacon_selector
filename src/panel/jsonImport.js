import db from '../database';
import { notify } from '../util/notify';

import Uppy from '@uppy/core';
import Dashboard from '@uppy/dashboard';
import Korean from '@uppy/locales/lib/ko_KR.js';

import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';

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
  files.forEach(async (file) => {
    const text = await file.data.text();
    const json = JSON.parse(text);

    // 키 존재 확인. 없으면 무시됨
    const pId = Object.keys(json)[0];

    if (
      (await db.emoticon.where('packageId').equals(Number(pId)).first()) > 0
    ) {
      const emoticons = json[pId];
      const updates = [];
      Object.keys(emoticons).forEach((conId) => {
        updates.push({
          key: Number(conId),
          changes: {
            tags: emoticons[conId],
          },
        });
      });

      if (updates.length > 0) {
        db.emoticon
          .bulkUpdate(updates)
          .then((count) => {
            notify(`${count}개의 아카콘 데이터를 업데이트했습니다.`);
          })
          .catch((e) => {
            notify(e, 'danger');
            console.error(e);
          });
      } else {
        notify('업데이트할 데이터가 없습니다.');
      }
    }
  });
});
