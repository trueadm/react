"use strict";

const setupBundle = require('./src/setup').setupBundle;
const compileBundle = require('./src/compiler').compileBundle;
const createHasteMap = require('./src/haste-map').createHasteMap;
const createBundle = require('./src/bundler').createBundle;
const optimizer = require('./src/optimizer');
const argv = require("minimist")(process.argv.slice(2));
const path = require("path");
const entryFilePath = argv._[0];
const outputFilePath = argv._[1];

if (!entryFilePath) {
  console.error("No entry file path supplied");
  process.exit(1);
}
if (!outputFilePath) {
  console.error("No output file path supplied");
  process.exit(1);
}
const resolveEntryFilePath = path.resolve(entryFilePath);
const destinationBundlePath = path.resolve(outputFilePath);

console.log(`Entry file path: "${resolveEntryFilePath}", Destination bundle path: ${destinationBundlePath}`);
console.log('Scanning for all JavaScript modules. This may take a while.');

createHasteMap(resolveEntryFilePath, destinationBundlePath)
  .then(createBundle)
  .then(setupBundle)
  .then(compileBundle)
  .then(code => {
    console.log('\nCompilation complete!');
    console.log(`Optimized Trees: ${optimizer.getOptimizedTrees()}`)
  }).catch(e => {
    console.error(e.stack);
    process.exit(1);
  });
