"use strict";

const traverse = require("babel-traverse").default;
const FunctionalComponent = require("./react/FunctionalComponent");
const t = require("babel-types");

function isReactComponent(name) {
  return name[0] === name[0].toUpperCase();
}

function getReactComponentBindings(ast) {
  const reactComponentIdentifiers = new Map();
  traverse(ast, {
    JSXElement(path) {
      const elementName = path.node.openingElement.name;

			// find <SomeComponent? ... />
      if (elementName.type === "JSXIdentifier") {
        if (isReactComponent(elementName.name)) {
          if (path.scope.hasBinding(elementName.name)) {
            const binding = path.scope.getBinding(elementName.name);
            reactComponentIdentifiers.set(binding.identifier, binding);
          }
        }
      } else {
        debugger;
      }
    },
    AssignmentExpression(path) {
      const node = path.node;
      if (node.operator === "=") {
				const left = node.left;
				const right = node.right;
				let moduleExportsFound = false;

				// find module.exports = ...
        if (left.type === "MemberExpression") {
          if (
            left.object.type === "Identifier" &&
            left.object.name === "module" &&
            left.property.type === "Identifier" &&
            left.property.name === "exports"
          ) {
						moduleExportsFound = true;
					}
				}
				// TODO support exporting an object
				// for now we only support a single identifier
				if (moduleExportsFound === true) {
					if (right.type === 'Identifier') {
						if (path.scope.hasBinding(right.name)) {
							const binding = path.scope.getBinding(right.name);
							reactComponentIdentifiers.set(binding.identifier, binding);
						}
					} else {
						debugger;
					}
				}
      }
    }
  });
  return reactComponentIdentifiers;
}

function createRandomString() {
	return Math.random()
	.toString(36)
	.replace(/[^a-z]+/g, "")
	.substring(0, 2);
}

function getReactComponents(ast, componentsFromBindings) {
	const componentsFromIdentifiers = new Map();
	const componentsFromNames = new Map();
  traverse(ast, {
		FunctionDeclaration(path) {
			const node = path.node;
			if (node.id !== null) {
				if (componentsFromBindings.has(node.id)) {
					let uniqueComponentName = node.id.name;

					if (componentsFromNames.has(uniqueComponentName)) {
						uniqueComponentName += createRandomString();
					}
					const component = new FunctionalComponent(uniqueComponentName, node);
					componentsFromIdentifiers.set(node.id, component);
					componentsFromNames.set(uniqueComponentName, component);
				}
			} else {
				debugger;
			}
		},
  });
  return {
		componentsFromIdentifiers,
		componentsFromNames,
	};
}

function prepareModuleForPrepack(ast, react) {
  traverse(ast, {
		TypeCastExpression(path) {
			let { node } = path;
			do {
				node = node.expression;
			} while (t.isTypeCastExpression(node));
			path.replaceWith(node);
		},
		AssignmentPattern({ node }) {
			node.left.optional = false;
		},
		FunctionDeclaration(path) {
			const node = path.node;
			const id = node.id;

			// replace functional component with a Prepack component helper
			if (id !== undefined && react.componentsFromIdentifiers.has(id)) {
				path.replaceWith(
					t.variableDeclaration('var', [
						t.variableDeclarator(id, t.callExpression(t.identifier('__constructReactComponent'), [
							t.stringLiteral(react.componentsFromIdentifiers.get(id).name),
							t.functionExpression(null, node.params, node.body, false)
						])),
					])
				);
			}
		},
		Function({ node }) {
			for (let i = 0; i < node.params.length; i++) {
				const param = node.params[i];
				param.optional = false;
				if (param.type === "AssignmentPattern") {
					param.left.optional = false;
				}
			}
			node.predicate = null;
		},
		TypeAlias(path) {
			path.remove();
		},
		Flow(path) {
			path.remove();
		},
		ImportDeclaration(path) {
			path.remove();
		},
		ClassProperty(path) {
			path.node.variance = null;
			path.node.typeAnnotation = null;
			if (!path.node.value) {
				path.remove();
			}
		},
		Class(path) {
			path.node.implements = null;
			path.get("body.body").forEach(child => {
				if (child.isClassProperty()) {
					child.node.typeAnnotation = null;
					if (!child.node.value) {
						child.remove();
					}
				}
			});
		},
  });
}

module.exports = {
	getReactComponentBindings,
	getReactComponents,
	prepareModuleForPrepack
};
