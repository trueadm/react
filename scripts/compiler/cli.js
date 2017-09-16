/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const {setupBundle} = require('./src/setup');
const {compileBundle} = require('./src/compiler');
const {createHasteMap} = require('./src/haste-map');
const {createBundle} = require('./src/bundler');
const optimizer = require('./src/optimizer');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const entryFilePath = argv._[0];
const outputFilePath = argv._[1];

if (!entryFilePath) {
  console.error('No entry file path supplied');
  process.exit(1);
}
if (!outputFilePath) {
  console.error('No output file path supplied');
  process.exit(1);
}
const resolveEntryFilePath = path.resolve(entryFilePath);
const destinationBundlePath = path.resolve(outputFilePath);

console.log(
  `Entry file path: "${resolveEntryFilePath}", Destination bundle path: ${destinationBundlePath}`
);
console.log('Scanning for all JavaScript modules. This may take a while.');

createHasteMap(resolveEntryFilePath, destinationBundlePath)
  .then(createBundle)
  .then(setupBundle)
  .then(compileBundle)
  .then(code => {
    console.log('\nCompilation complete!');
    console.log(`Optimized Trees: ${optimizer.getOptimizedTrees()}`);
  })
  .catch(e => {
    console.error(e.stack);
    process.exit(1);
  });
