"use strict";

const rollup = require("@trueadm/rollup").rollup;
const commonjs = require("@trueadm/rollup-plugin-commonjs");
const alias = require("rollup-plugin-alias");
const flow = require("rollup-plugin-flow");
const babel = require("rollup-plugin-babel");

function createBundle(result) {
  const entryFilePath = result.entryFilePath;
  const destinationBundlePath = result.destinationBundlePath;
  const hasteMap = result.hasteMap;
  const config = {
    entry: entryFilePath,
    plugins: [
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        runtimeHelpers: false,
        externalHelpers: false,
        plugins: [
          "syntax-flow",
          "syntax-jsx",
          require("./plugins/babel-plugin-fbt"),
          "transform-class-properties",
          "transform-flow-strip-types",
          "syntax-object-rest-spread",
          ["transform-object-rest-spread", { useBuiltIns: true }]
        ]
      }),
      flow(),
      commonjs()
    ]
  };
  if (hasteMap !== null) {
    config.plugins.unshift(alias(hasteMap));
  } else {
    config.onwarn = function() {};
  }

  return rollup(config)
    .then(rollupResult => {
      return rollupResult.write({
        dest: destinationBundlePath,
        format: "cjs",
        interop: false
      });
    })
    .then(() => Promise.resolve(destinationBundlePath));
}

module.exports = {
  createBundle: createBundle
};
