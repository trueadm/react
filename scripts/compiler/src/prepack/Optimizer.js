"use strict";

const { ModuleEnvironment, call, setGlobals, realm } = require("./evaluator");
const t = require("babel-types");
const babel = require("babel-core");
const mocks = require("./mocks");
const Serializer = require("prepack/lib/serializer/index.js").default;
const Reconciler = require('../react/Reconciler');
const { prepareModuleForPrepack } = require("../traversalUtils");
const {
  AbstractValue,
} = require("prepack/lib/values");

function sanitizeValue(value) {
  // wrap value in a return statement
  if (value instanceof AbstractValue) {
    let originalBuildNode = value._buildNode;
    value._buildNode = args => {
      const node = originalBuildNode(args);
			return t.returnStatement(node);
    };
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
		const callExpression = t.callExpression(t.functionExpression(null, component.ast.params, component.ast.body), []);
		const effects = this.realm.evaluateNodeForEffectsInGlobalEnv(callExpression, this.realm.tracers[0]);
		const generator = effects[1];
		const renderValue = this._foldComponentTree(component, componentType);
		if (renderValue !== null) {
      this.stats.optimizedTrees++;
			generator.body.push(sanitizeValue(renderValue));
			this.functions.writeEffects.set(componentName, effects);
      this.functions.nameToFunctionValue.set(componentName, componentType);
		}
		return componentType;
	}
	_foldComponentTree(component, componentType) {
		component.type = componentType;
		const reconciler = new Reconciler(this.react, this.moduleEnv, this.stats);
		return reconciler.render(component);
	}
}



module.exports = Optimizer;
