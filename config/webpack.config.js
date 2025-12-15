'use strict';

const { merge } = require('webpack-merge');
const glob = require('glob');
const path = require('path');

const common = require('./webpack.common.js');
// const PATHS = require('./paths');

// Merge webpack configuration files
const config = (env, argv) => {
  const target = env.target; // chrome | firefox
  if (!target) throw new Error('env.target required');


  // Windows 경로(\)를 glob이 인식할 수 있도록 /로 변경합니다.
  // const srcPath = PATHS.src.replace(/\\/g, '/');
  const srcPath = path.resolve(__dirname, '..', target, 'src').replace(/\\/g, '/');
  const entries = glob
    .sync(`${srcPath}/**/*.{js,ts}`)
    .reduce((acc, filePath) => {
      const entryName = path.basename(filePath, path.extname(filePath));
      acc[entryName] = filePath;
      return acc;
    }, {});

  return merge(common(env, argv), {
    entry: entries,
    devtool: argv.mode === 'production' ? false : 'source-map',
    context: __dirname,
  });
};

module.exports = config;
