// 치명적인 결함이 생겼을 경우 태그를 백업

import db from '../database';
import * as JSZip from 'jszip';

// 패키지 목록 json파일화, zip파일로 다운로드.
async function downloadTags(packageIds: string[] | number[]) {
  packageIds = packageIds.map(Number);
  const heads = (await browser.storage.local.get('arcacon_package')).arcacon_package || {};

  const promises = packageIds.map(async (pID) => {
    const headInfo = await db.package_info.get(pID);
    const emoticon = await db.emoticon.where('packageId').equals(pID).toArray();
    debugger;
    return [
      pID,
      {
        packageID: pID,
        headerTag: headInfo.tags || [],
        atLocal: {
          packageName: heads[pID].packageName,
          title: heads[pID].title,
        },
        emoticon: emoticon
          .map(({ conId, tags }) => ({ conId, tags }))
          .filter((e) => e.tags),
      },
    ];
  });

  // pID: value 형태의 객체로 다시 복원
  const done = Object.fromEntries(await Promise.all(promises));

  const z = JSZip();
  const yymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const packageId of packageIds) {
    const value = done[packageId];
    if (!value) continue;

    const content = JSON.stringify(value, null, 2);
    z.file(`${packageId}-${yymmdd}.json`, content);
  }

  const file = await z.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(file);

  try {
    browser.downloads.download({
      url,
      filename: `arcacons-tags-${yymmdd}.zip`,
      saveAs: true,
    });
  } catch (e) {
    console.log(e);
  }
}

document.getElementById('emergency').addEventListener('click', e => {
    browser.storage.local.get('arcacon_package')
    .then(data => {
        data = data.arcacon_package;
        downloadTags(Object.keys(data));
    })
});