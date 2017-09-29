/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const glob = require('glob');
const path = require('path');
const fs = require('fs');
const sha256 = require('js-sha256');

const cacheDirectory = path.join(__dirname, '..', '_cache');
const ignore = {
  React: true,
  ReactDOM: true,
  PropTypes: true,
};

function getCache(pathKey) {
  if (fs.existsSync(cacheDirectory)) {
    const filename = path.join(
      cacheDirectory,
      sha256(pathKey).substring(0, 10) + '.json'
    );
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data);
    }
  }
  return null;
}

function updateCache(pathKey, map) {
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory);
  }
  fs.writeFileSync(
    path.join(cacheDirectory, sha256(pathKey).substring(0, 10)) + '.json',
    JSON.stringify(map)
  );
}

function createHasteMap(entryFilePath, destinationBundlePath) {
  const processCwd = process.cwd();
  let hasteMap = getCache(processCwd);
  // if our cache is empty, we need to create a new haste map
  if (hasteMap === null) {
    hasteMap = {};
    return new Promise((resolve, reject) => {
      glob(
        processCwd + '/**/*.js',
        {
          ignore: '**/node_modules/**/*',
        },
        (er, files) => {
          for (let i = 0, length = files.length; i < length; i++) {
            const filename = files[i];
            const file = path.basename(filename, '.js');
            if (!ignore[file]) {
              hasteMap[file] = filename;
            }
          }
          updateCache(processCwd, hasteMap);
          resolve({
            entryFilePath: entryFilePath,
            destinationBundlePath: destinationBundlePath,
            hasteMap: hasteMap,
          });
        }
      );
    });
  } else {
    return Promise.resolve({
      entryFilePath: entryFilePath,
      destinationBundlePath: destinationBundlePath,
      hasteMap: hasteMap,
    });
  }
}

module.exports = {
  createHasteMap: createHasteMap,
};
