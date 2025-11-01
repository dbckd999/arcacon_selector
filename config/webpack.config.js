'use strict';

const { merge } = require('webpack-merge');

const common = require('./webpack.common.js');
const PATHS = require('./paths');

// Merge webpack configuration files
const config = (env, argv) =>
  merge(common, {
    entry: {
      boardContentScript: PATHS.src + '/board-content-script.js',
      popup: PATHS.src + '/popup.js',
      orderContentScript: PATHS.src + '/order-content-script.js',
      saleContentScript: PATHS.src + '/sale-content-script.js',
      serviceWorker: PATHS.src + '/service-worker.js',
    },
    devtool: argv.mode === 'production' ? false : 'source-map',
  });

module.exports = config;
