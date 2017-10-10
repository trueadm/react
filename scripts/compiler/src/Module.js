"use strict";

const { parse } = require("babylon");
const Optimizer = require("./prepack/Optimizer");

class Module {
  constructor(source) {
    this.ast = parse(source, {
      plugins: ["jsx", "flow"],
      sourceType: "module"
		});
  }
  async compileReactComponentTrees() {
		const optimizer = new Optimizer(this.react);
		const {code, stats} = optimizer.serialize(this.ast);
    return {
      stats,
      source: code,
    };
  }
}

module.exports = Module;
