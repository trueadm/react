"use strict";

const { readFile, writeFile } = require("fs");
const { promisify } = require("util");
const Module = require("./Module");

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

async function compileFile(inputPath, outputPath) {
  const source = await readFileAsync(inputPath, "utf8");
  const {
    compiledSource,
    optimizedTrees,
    inlinedComponents
  } = await compileSource(source);
  await writeFileAsync(outputPath, compiledSource);
  return {
    compiledSource,
    optimizedTrees,
    inlinedComponents
  };
}

async function compileSource(source) {
  const module = new Module(source);

  const {
    source: compiledSource,
    stats,
  } = await module.compileReactComponentTrees();
  return {
    compiledSource,
    optimizedTrees: stats.optimizedTrees,
    inlinedComponents: stats.inlinedComponents
  };
}

module.exports = {
  compileFile,
  compileSource
};
