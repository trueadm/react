"use strict";

const t = require("babel-types");
const fs = require("fs");
const evaluator = require("./evaluator");
const optimizeComponentTree = require("./optimizer").optimizeComponentTree;
const traverser = require("./traverser");
const babel = require('babel-core');
const createBundle = require('./bundler').createBundle;

async function compileBundle(result) {
  const prepackMetadata = result.prepackMetadata;
  const destinationBundlePath = result.destinationBundlePath;
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
  traverser.traverse(ast.program, traverser.Actions.ReplaceWithOptimized, moduleScope);

  const transformedCode = babel.transformFromAst(ast, {
    presets: [],
    plugins: [
      // this doesn't seem to do DCE on JSX :(
      // ['minify-dead-code-elimination', {"optimizeRawSize": true}]
    ],
  }).code;
  fs.writeFileSync(destinationBundlePath, transformedCode);
  // let's use Rollup again for DCE! it handles JSX with our fork
  // return createBundle({
  //   hasteMap: null,
  //   entryFilePath: destinationBundlePath,
  //   destinationBundlePath: destinationBundlePath,
  // });
}

module.exports = {
  compileBundle: compileBundle,
};
