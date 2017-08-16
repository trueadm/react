"use strict";

const rollup = require('rollup').rollup;
const commonjs = require('rollup-plugin-commonjs');

function createBundle(result) {
  const entryFilePath = result.entryFilePath;
  const destinationBundlePath = result.destinationBundlePath;
  const hasteMap = result.hasteMap;

  return rollup({
    entry: entryFilePath,
    plugins: [
      commonjs(),
    ],
  }).then(rollupResult => {
    return rollupResult.write({
      dest: destinationBundlePath,
      format: 'cjs',
      interop: false,
    });
  }).then(() => Promise.resolve(destinationBundlePath));
}

module.exports = {
  createBundle: createBundle,
};
