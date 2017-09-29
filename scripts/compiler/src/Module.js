"use strict";

const { parse } = require("babylon");
const Optimizer = require("./prepack/Optimizer");
const {
  getReactComponentBindings,
	getReactComponents,
	prepareModuleForPrepack,
} = require("./traversalUtils");

class Module {
  constructor(source) {
    this.ast = parse(source, {
      plugins: ["jsx", "flow"],
      sourceType: "module"
		});
		const componentBindings = getReactComponentBindings(this.ast);
		const components = getReactComponents(this.ast, componentBindings);
    this.react = {
			components,
			componentBindings,
		};
  }
  async compileReactComponentTrees() {
		const optimizer = new Optimizer();
		// TODO clone ast? as this will mutuate it
		prepareModuleForPrepack(this.ast);
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
