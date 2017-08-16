"use strict";

const t = require("babel-types");
const fs = require("fs");
const evaluator = require("./evaluator");
const optimizeComponentTree = require("./optimizer").optimizeComponentTree;
const traverser = require("./traverser");
const babel = require('babel-core');
const createBundle = require('./bundler').createBundle;

function constructModuleExports(componentTree) {
  return t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(t.identifier("module"), t.identifier("exports")),
      componentTree
    )
  );
}

// this is a slow implementation to do this, can be refactored to perform better
function constructExternalImports(externalModules, assignments) {
  const assignmentKeys = Array.from(assignments.keys());
  const moduleImports = externalModules.map(externalModule => {
    // find the externalModule in the assignments

    for (let i = 0; i < assignmentKeys.length; i++) {
      const assignmentKey = assignmentKeys[i];
      let assignment = assignments.get(assignmentKey);
      let pass = false;

      if (Array.isArray(assignment)) {
        assignment = traverser.handleMultipleValues(assignment);
      }
      if (assignment.type === 'FunctionCall') {
        if (assignment.identifier !== null && assignment.identifier.name === 'require') {
          if (assignment.args.length === 1 && assignment.args[0] === externalModule) {
            pass = true;
          }
        }
      } else if (assignment.type === 'AbstractUnknown' && assignment.crossModule === true) {
        pass = true;
      }
      if (pass === true) {
        return t.variableDeclaration('var',
        [t.variableDeclarator(t.identifier(assignmentKey), assignment.astNode)]
        );
      }
    }
  });
  return t.blockStatement(moduleImports);
}

function setupPrepackEnvironment(declarations) {
  const moduleEnv = new evaluator.ModuleEnvironment();
  // eval and declare all declarations
  Object.keys(declarations).forEach(declarationKey => {
    const declaration = declarations[declarationKey];
    // if the type is undefined, its most likely abstract
    if (declaration.type === undefined) {
      moduleEnv.declare(declarationKey, declaration);
    } else {
      const evaluation = moduleEnv.eval(declaration);
      moduleEnv.declare(declarationKey, evaluation);
    }
  });
  return moduleEnv;
}

function compileBundle(result) {
  const prepackMetadata = result.prepackMetadata;
  const destinationBundlePath = result.destinationBundlePath;
  const defaultExportComponent = prepackMetadata.defaultExport.astNode;
  const moduleScope = result.moduleScope;
  const ast = result.ast;

  optimizeComponentTree(
    ast,
    setupPrepackEnvironment(prepackMetadata.declarations),
    defaultExportComponent
  );
  // clear the deferredScopes, as we may have removed some scopes
  moduleScope.deferredScopes = [];
  traverser.traverse(ast.program, traverser.Actions.ReplaceWithOptimized, moduleScope);

  const transformedCode = babel.transformFromAst(ast, {
    presets: [],
    plugins: [
      // this doesn't seem to do DCE on JSX :(
      // ['minify-dead-code-elimination', {"optimizeRawSize": true}]
    ]
  }).code;
  fs.writeFileSync(destinationBundlePath, transformedCode);
  // let's use Rollup again for DCE! it handles JSX with our fork
  return createBundle({
    hasteMap: null,
    entryFilePath: destinationBundlePath,
    destinationBundlePath: destinationBundlePath,
  });
}

module.exports = {
  compileBundle: compileBundle,
};
