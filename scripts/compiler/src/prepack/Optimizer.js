"use strict";

const {
	ModuleEnvironment,
	call,
	setGlobals,
	realm
} = require('./prepack');
const t = require("babel-types");
const babel = require('babel-core');
const mocks = require('./mocks');
const Serializer = require("prepack/lib/serializer/index.js").default;

class Optimizer {
	constructor() {
		this.moduleEnv = new ModuleEnvironment();
		this.serializerOptions = {
			serialize: true,
			uniqueSuffix: "",
			errorHandler: () => {
				debugger;
			},
			maxStackDepth: 20,
		};
		setGlobals(this.moduleEnv, mocks);
	}
	serialize(ast) {
		const code = `(function(){${babel.transformFromAst(ast).code}})()`;
		const serializer = new Serializer(realm, this.serializerOptions);
		const sources = [{ filePath: '', fileContents: code }];
		const serialized = serializer.init(sources, false);

		return serialized.code;
	}
}

module.exports = Optimizer;
