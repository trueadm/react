"use strict";

// const { ModuleEnvironment, call, setGlobals, realm } = require("./helpers");
const t = require("babel-types");
const babel = require("babel-core");
const Reconciler = require("../react/Reconciler");
const prepackSources = require("prepack/lib/prepack-node").prepackSources;
const { prepareModuleForPrepack } = require("../traversalUtils");
const { initializeGlobals } = require("./mocks");
const { AbstractValue } = require("prepack/lib/values");

function sanitizeValue(value) {
  // wrap value in a return statement
  if (value instanceof AbstractValue) {
    let originalBuildNode = value._buildNode;
    if (typeof originalBuildNode === "function") {
      value._buildNode = args => {
        const node = originalBuildNode(args);
        return t.returnStatement(node);
      };
    } else {
      value._buildNode = t.returnStatement(value._buildNode);
    }
    return value;
  } else {
    value.args = [value];
    value.buildNode = function(args, context) {
      return t.returnStatement(context.serializeValue(value));
    };
    return value;
  }
}

class Optimizer {
  constructor(react) {
    this.prepackOptions = {
      errorHandler: diag => "Fail",
      internalDebug: true,
      serialize: true,
      uniqueSuffix: "",
      maxStackDepth: 100,
      reactEnabled: true,
      additionalGlobals: initializeGlobals
    };
    // setGlobals(this.moduleEnv, mocks, this._serializeComponentTree.bind(this));
  }
  serialize(ast) {
    // clone AST befor hande?
    // prepareModuleForPrepack(ast, this.react);
    const code = `(function(){${babel.transformFromAst(ast).code}})()`;
    const serialized = prepackSources(
      [{ filePath: '', fileContents: code, sourceMapContents: "" }],
      this.prepackOptions
    );

    return {
      stats: {
        optimizedTrees: 0,
        inlinedComponents: 0
      },
      code: serialized.code
    };
  }
  _serializeComponentTree(componentName, componentType) {
    const component = this.react.componentsFromNames.get(componentName);
    const componentFunc = t.arrowFunctionExpression(
      component.ast.params,
      component.ast.body
    );
    const callExpression = t.callExpression(componentFunc, []);
    const effects = this.realm.evaluateNodeForEffectsInGlobalEnv(
      callExpression
    );
    const generator = effects[1];

    componentType.$LazyEval = () => {
      const renderValue = this._foldComponentTree(component, componentType);
      if (renderValue !== null) {
        this.stats.optimizedTrees++;
        generator.addEntry(sanitizeValue(renderValue));
      }
    };
    this.functions.writeEffects.set(componentName, effects);
    this.functions.nameToFunctionValue.set(componentName, componentType);
    return componentType;
  }
  _foldComponentTree(component, componentType) {
    component.type = componentType;
    const reconciler = new Reconciler(this.react, this.realm, this.stats);
    return reconciler.render(component);
  }
}

module.exports = Optimizer;
