"use strict";

const setupSource = require('./src/setup').setupSource;
const compileSource = require('./src/compiler').compileSource;

async function compileSourceEntry(source) {
	return setupSource(source).then(compileSource);
}

module.exports = compileSourceEntry;
