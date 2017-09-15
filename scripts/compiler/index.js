"use strict";

const setupSource = require('./src/setup').setupSource;
const compileSource = require('./src/compiler').compileSource;
const getOptimizedTrees = require('./src/optimizer').getOptimizedTrees;

async function compileSourceEntry(source) {
	return setupSource(source).then(compileSource).then(code => ({
    code,
    optimizedTrees: getOptimizedTrees(),
  }));
}

module.exports = compileSourceEntry;
