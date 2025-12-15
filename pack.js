const { readFileSync, existsSync, mkdirSync } = require('fs');
const { parse, resolve } = require('path');
const AdmZip = require('adm-zip');

try {

  const target = process.argv.find(v => v.startsWith('--target='))?.split('=')[1];
  if (!target) throw new Error('target required');

  console.log(resolve(__dirname, target, 'build', 'manifest.json'));
  const { base } = parse(__dirname);
  const { version } = JSON.parse(
    readFileSync(resolve(__dirname, target, 'build', 'manifest.json'), 'utf8')
  );

  const outdir = 'release';
  const filename = `${base}-${target}-v${version}.zip`;
  const zip = new AdmZip();

  const buildDir = resolve(__dirname, target, 'build');
  zip.addLocalFolder(buildDir);
  if (!existsSync(outdir)) {
    mkdirSync(outdir);
  }
  zip.writeZip(`${outdir}/${filename}`);

  console.log(
    `Success! Created a ${filename} file under ${outdir} directory. You can upload this file to web store.`
  );
} catch (e) {
  console.error(e);
  console.error('Error! Failed to generate a zip file.');
}
