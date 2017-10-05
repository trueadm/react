"use strict";

const { ModuleEnvironment, call, setGlobals, realm } = require("./evaluator");
const t = require("babel-types");
const babel = require("babel-core");
const mocks = require("./mocks");
const Serializer = require("prepack/lib/serializer/index.js").default;
const Reconciler = require('../react/Reconciler');
const { Generator, PreludeGenerator, NameGenerator } = require("prepack/lib/utils/generator.js");
const { prepareModuleForPrepack } = require("../traversalUtils");
const {
  AbstractValue,
} = require("prepack/lib/values");

function sanitizeValue(value, preludeGenerator) {
  // wrap value in a return statement
  if (value instanceof AbstractValue) {
    let originalBuildNode = value._buildNode;
    if (typeof originalBuildNode === 'function') {
      value._buildNode = args => {
        const node = originalBuildNode(args);
        return t.returnStatement(node);
      };
    } else {
      // if (value._buildNode.type === 'Identifier' && preludeGenerator.derivedIds.has(value._buildNode.name)) {
      //   return sanitizeValue(preludeGenerator.derivedIds.get(value._buildNode.name)[0], preludeGenerator);
      // }
      value._buildNode = t.returnStatement(value._buildNode);
    }
    return value;
  } else {
    value.args = [value];
    value.buildNode = function (args, context) {
      return t.returnStatement(context.serializeValue(value));
    };
    return value;
  }
}

class Optimizer {
  constructor(react) {
    this.moduleEnv = new ModuleEnvironment();
    this.serializerOptions = {
      serialize: true,
      uniqueSuffix: "",
      errorHandler: () => {},
      maxStackDepth: 20
		};
		this.realm = this.moduleEnv.lexicalEnvironment.realm;
		this.react = react;
    this.functions = null;
    this.stats = {
      optimizedTrees: 0,
      inlinedComponents: 0,
    };
    setGlobals(this.moduleEnv, mocks, this._serializeComponentTree.bind(this));
  }
  serialize(ast) {
    // clone AST befor hande?
    prepareModuleForPrepack(
      ast,
      this.react
    );
    const code = `(function(){${babel.transformFromAst(ast).code}})()`;
		const serializer = new Serializer(realm, this.serializerOptions);
		this.functions = serializer.functions;
		const sources = [{ filePath: "", fileContents: code }];
    const serialized = serializer.init(sources, false);
	
    return {
      stats: this.stats,
      code: serialized.code,
    };
  }
  _serializeComponentTree(componentName, componentType) {
    const component = this.react.componentsFromNames.get(componentName);
    const componentFunc = t.arrowFunctionExpression(component.ast.params, component.ast.body);
    const callExpression = t.callExpression(componentFunc, []);
    const effects = this.realm.evaluateNodeForEffectsInGlobalEnv(callExpression);
    const generator = effects[1];
  
    componentType.$LazyEval = () => {
      const renderValue = this._foldComponentTree(component, componentType);
      if (renderValue !== null) {
          this.stats.optimizedTrees++;
          generator.addEntry(sanitizeValue(renderValue, generator.preludeGenerator));
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
