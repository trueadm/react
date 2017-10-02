'use strict';

const { __abstract, __object } = require("../prepack/evaluator");

function flowAnnotationToObject(annotation) {
	if (annotation.type === 'TypeAnnotation') {
		return flowAnnotationToObject(annotation.typeAnnotation);
	} else if (annotation.type === 'BooleanTypeAnnotation') {
		return 'boolean';
	} else if (annotation.type === 'ObjectTypeAnnotation') {
		const obj = {};
		annotation.properties.forEach(property => {
			if (property.type === 'ObjectTypeProperty') {
				if (property.key.type === 'Identifier') {
					obj[property.key.name] = flowAnnotationToObject(property.value);
				} else {
					debugger;
				}
			} else {
				debugger;
			}
		});
		return obj;
	} else {
		debugger;
	}
}

function getPropTypes(ast) {
	if (ast.params.length > 0 && ast.params[0].typeAnnotation !== undefined) {
		return flowAnnotationToObject(ast.params[0].typeAnnotation);
	}
	return null;
}

function convertToAbstractValue(value, name) {
	if (typeof value === 'string') {
		return __abstract(value, name);
	} else if (typeof value === 'object' && value !== null) {
		const obj = {};
		Object.keys(value).forEach(key => {
			obj[key] = convertToAbstractValue(value[key], key);
		});
		return __object(obj, name);
	} else {
		return __abstract('object', name);
	}
}

class FunctionalComponent {
	constructor(name, ast) {
		this.name = name;
		this.ast = ast;
		this.type = null;
		this.propTypes = getPropTypes(this.ast);
	}
	getInitialProps() {
		return convertToAbstractValue(this.propTypes, 'props')
	}
	getInitialContext() {
		return __abstract('object', 'context');
	}
}

module.exports = FunctionalComponent;
