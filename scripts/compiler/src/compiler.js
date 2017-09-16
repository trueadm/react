/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const fs = require('fs');
const {optimizeComponentTree} = require('./optimizer');
const traverser = require('./traverser');
const babel = require('babel-core');
const createBundle = require('./bundler').createBundle;

async function compileBundle(result) {
  const destinationBundlePath = result.destinationBundlePath;
  const transformedCode = await compileSource(result);
  fs.writeFileSync(destinationBundlePath, transformedCode);
  // let's use Rollup again for DCE! it handles JSX with our fork
  return createBundle({
    hasteMap: null,
    entryFilePath: destinationBundlePath,
    destinationBundlePath: destinationBundlePath,
  });
}

async function compileSource(result) {
  const prepackMetadata = result.prepackMetadata;
  const defaultExportComponent = prepackMetadata.defaultExport.astNode;
  const moduleScope = result.moduleScope;
  const ast = result.ast;
  const source = result.source;

  await optimizeComponentTree(
    ast,
    prepackMetadata.env,
    defaultExportComponent,
    moduleScope,
    source
  );
  // clear the deferredScopes, as we may have removed some scopes
  moduleScope.deferredScopes = [];
  traverser.traverse(
    ast.program,
    traverser.Actions.ReplaceWithOptimized,
    moduleScope
  );

  const transformedCode = babel.transformFromAst(ast, {
    presets: [],
    plugins: [
      // this doesn't seem to do DCE on JSX :(
      // ['minify-dead-code-elimination', {"optimizeRawSize": true}]
    ],
  }).code;

  return transformedCode;
}

module.exports = {
  compileBundle,
  compileSource,
};
