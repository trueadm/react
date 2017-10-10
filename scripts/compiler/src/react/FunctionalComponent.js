'use strict';

const { __abstract, __object } = require("../prepack/helpers");

function flowAnnotationToObject(annotation, path) {
	if (annotation.type === 'TypeAnnotation') {
		return flowAnnotationToObject(annotation.typeAnnotation, path);
	} else if (annotation.type === 'GenericTypeAnnotation') {
		if (annotation.id.type === 'Identifier') {
			const identifier = annotation.id.name;

			switch (identifier) {
				case 'Function':
					return 'function';
				case 'Object':
					return 'object';
				case 'any':
				case 'empty:':
					return 'empty';
				default:
					// get the Flow type
					if (path.scope.hasBinding(identifier) === true) {
						const flowNode = path.scope.getBinding(identifier).path.node.right;
						return flowAnnotationToObject(flowNode, path);
					}
			}
		} else {
			debugger;
		}
	} else if (annotation.type === 'EmptyTypeAnnotation') {
		return 'empty';
	} else if (annotation.type === 'BooleanTypeAnnotation') {
		return 'boolean';
	} else if (annotation.type === 'StringTypeAnnotation') {
		return 'string';
	} else if (annotation.type === 'NumberTypeAnnotation') {
		return 'number';
	} else if (annotation.type === 'ObjectTypeAnnotation') {
		const obj = {};
		annotation.properties.forEach(property => {
			if (property.type === 'ObjectTypeProperty') {
				if (property.key.type === 'Identifier') {
					obj[property.key.name] = flowAnnotationToObject(property.value, path);
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

function getPropTypes(ast, path) {
	if (ast.params.length > 0 && ast.params[0].typeAnnotation !== undefined) {
		return flowAnnotationToObject(ast.params[0].typeAnnotation, path);
	}
	return null;
}

function getPropsName(ast, path) {
	if (ast.params.length > 0 && ast.params[0].type === 'Identifier') {
		return ast.params[0].name;
	}
	return null;
}

function convertToAbstractValue(value, name) {
	if (typeof value === 'string') {
		return __abstract(value, name || 'unknown');
	} else if (typeof value === 'object' && value !== null) {
		const obj = {};
		Object.keys(value).forEach(key => {
			const newName = name !== null ? `${name}.${key}` : key;
			obj[key] = convertToAbstractValue(value[key], newName);
		});
		return __object(obj, name || 'unknown');
	} else {
		return __abstract('object', name || 'unknown');
	}
}

class FunctionalComponent {
	constructor(name, ast, path) {
		this.name = name;
		this.ast = ast;
		this.type = null;
		this.propTypes = getPropTypes(this.ast, path);
		this.propsName = getPropsName(this.ast, path);
		this.defaultPropsObjectExpression = null;
	}
	getInitialProps() {
		return convertToAbstractValue(this.propTypes, this.propsName);
	}
	getInitialContext() {
		return __abstract('object', 'context');
	}
}

module.exports = FunctionalComponent;
