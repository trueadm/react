"use strict";

const rollup = require('rollup').rollup;
const commonjs = require('rollup-plugin-commonjs');
const alias = require('rollup-plugin-alias');

function createBundle(result) {
  const entryFilePath = result.entryFilePath;
  const destinationBundlePath = result.destinationBundlePath;
  const hasteMap = result.hasteMap;
  const config = {
    entry: entryFilePath,
    plugins: [
      commonjs(),
    ],
  };
  if (hasteMap !== null) {
    config.plugins.unshift(alias(hasteMap));
  } else {
    config.onwarn = function() {};
  }

  return rollup(config).then(rollupResult => {
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
