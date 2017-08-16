// Copyright 2004-present Facebook. All Rights Reserved.

"use strict";

const glob = require("glob");
const path = require("path");
const fs = require("fs");
const sha256 = require("js-sha256");

const cacheDirectory = path.join(__dirname, "_cache");

function getCache(pathKey) {
  if (fs.existsSync(cacheDirectory)) {
    const filename = path.join(
      cacheDirectory,
      sha256(pathKey).substring(0, 10) + ".json"
    );
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, "utf8");
      return new Map(JSON.parse(data));
    }
  }
  return null;
}

function updateCache(pathKey, map) {
  if (!fs.existsSync(cacheDirectory)) {
    fs.mkdirSync(cacheDirectory);
  }
  fs.writeFileSync(
    path.join(cacheDirectory, sha256(pathKey).substring(0, 10)) + ".json",
    JSON.stringify(Array.from(map))
  );
}

function getHasteMap(entryFilePath, destinationBundlePath) {
  const processCwd = process.cwd();
  let hasteMap = getCache(processCwd);
  // if our cache is empty, we need to create a new haste map
  if (hasteMap === null) {
    hasteMap = new Map();
    return new Promise((resolve, reject) => {
      glob(
        processCwd + "/**/*.js",
        {
          ignore: "**/node_modules/**/*"
        },
        (er, files) => {
          for (let i = 0, length = files.length; i < length; i++) {
            const filename = files[i];
            hasteMap.set(path.basename(filename, ".js"), filename);
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
  getHasteMap: getHasteMap
};
