"use strict";

const { parse } = require("babylon");
const Optimizer = require("./prepack/Optimizer");
const {
  getReactComponentBindings,
	getReactComponents,
} = require("./traversalUtils");

class Module {
  constructor(source) {
    this.ast = parse(source, {
      plugins: ["jsx", "flow"],
      sourceType: "module"
		});
    const {componentsFromBindings, jsxIdentifiersToBindings} = getReactComponentBindings(this.ast);
    const {componentsFromIdentifiers, componentsFromNames} = getReactComponents(this.ast, componentsFromBindings);
    this.react = {
      jsxIdentifiersToBindings,
      componentsFromIdentifiers,
      componentsFromNames,
			componentsFromBindings,
		};
  }
  async compileReactComponentTrees() {
		const optimizer = new Optimizer(this.react);
		const output = optimizer.serialize(this.ast);
    return {
      stats: {
        optimizedTrees: 0,
        inlinedComponents: 0
      },
      source: output,
    };
  }
}

module.exports = Module;
