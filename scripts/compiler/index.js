/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const {compileSource} = require('./src/compiler');

async function compileSourceEntry(source) {
  return compileSource(source).then(result => ({
    code: result.compiledSource,
    optimizedTrees: result.optimizedTrees,
  }));
}

module.exports = compileSourceEntry;
