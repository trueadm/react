"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const reconciler = require("./reconciler");
const serializer = require("./serializer");
const Types = require("./types").Types;

function convertToExpression(node) {
  if (node.type === "FunctionDeclaration") {
    node.type = "FunctionExpression";
  }
  return node;
}

function convertAccessorsToNestedObject(accessors, propTypes) {
  const keys = Array.from(accessors.keys());
  const propKeys = propTypes ? Array.from(propTypes.keys()) : [];
  
  if (keys.length > 0 || propKeys.length > 0) {
    const object = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      object[key] = Types.ANY;
    }
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i];
      let value = propTypes.get(key);

      if (value.type === 'FunctionCall') {
        switch (value.identifier) {
          case Types.ONE_OF:
            const newObj = {};
            Array.from(value.args[0].properties.values()).forEach(val => {
              newObj[val] = Types.ANY;
            });
            value = newObj;
            break;
          default:
            debugger;
        }
      } else if (value.type === 'ConditionalExpression') {
        // TODO
        // as we are inlikely to know this statically, let's assume any
        value = Types.ANY;
      } else if (value.type !== undefined) {
        debugger;
      }
      object[key] = value;
    }
    return object;
  }
  return null;
}

function convertNestedObjectToAst(object) {
  return t.objectExpression(
    Object.keys(object).map(key => {
      const value = object[key];
      if (typeof value === 'object') {
        return t.objectProperty(t.identifier(key), convertNestedObjectToAst(value));
      } else {
        switch (value) {
          case Types.ARRAY:
          case Types.OBJECT:
          case Types.STRING:
          case Types.NUMBER:
          case Types.FUNC:
          case Types.BOOL:
          case Types.ANY:
            return t.objectProperty(t.identifier(key), t.nullLiteral());
          default: {
            debugger;
          }
        }
      }
    })
  );
}

function setAbstractPropsUsingNestedObject(ast, object, prefix, root) {
  const properties = ast.properties;
  Object.keys(object).forEach(key => {
    const value = object[key];
    const newPrefix = `${prefix}.${key}`;

    if (typeof value === 'object') {
      setAbstractPropsUsingNestedObject(properties.get(key).descriptor.value, value, newPrefix, false);
    } else {
      switch (value) {
        case Types.ARRAY:
          properties.get(key).descriptor.value = evaluator.createAbstractArray(newPrefix);
          break;
        case Types.OBJECT:
          properties.get(key).descriptor.value = evaluator.createAbstractObject(newPrefix);
          break;
        case Types.NUMBER:
          properties.get(key).descriptor.value = evaluator.createAbstractNumber(newPrefix);
          break;
        case Types.STRING:
          properties.get(key).descriptor.value = evaluator.createAbstractString(newPrefix);
          break;
        case Types.FUNC:
          properties.get(key).descriptor.value = evaluator.createAbstractFunction(newPrefix);
          break;
        case Types.BOOL:
          properties.get(key).descriptor.value = evaluator.createAbstractBoolean(newPrefix);
          break;
        case Types.ANY:
          properties.get(key).descriptor.value = evaluator.createAbstractUnknown(newPrefix);
          break;
        default: {
          debugger;
        }
      }
    }
  });
}

function createAbstractPropsObject(scope, astComponent, moduleEnv) {
  const type = astComponent.type;
  let propsShape = null;

  // props is the first param of the function component
  if (type === 'FunctionExpression' || type === 'FunctionDeclaration') {
    const propsInScope = astComponent.func.params[0];
    if (propsInScope !== undefined) {
      let propTypes = null;
      if (astComponent.func.properties.properties.has('propTypes')) {
        const propTypesObject = astComponent.func.properties.properties.get('propTypes');
        propTypes = propTypesObject.properties;
        // so the propTypes gets removed
        propTypesObject.astNode.optimized = true;
        propTypesObject.astNode.optimizedReplacement = null;
      }
      propsShape = convertAccessorsToNestedObject(propsInScope.accessors, propTypes);
    }
  } else if (type === 'ClassExpression' || type === 'ClassDeclaration') {
    const theClass = astComponent.class;
    const propsOnClass = theClass.thisObject.accessors.get('props');
    if (propsOnClass !== undefined) {
      propsShape = convertAccessorsToNestedObject(propsOnClass.accessors, theClass.propTypes ? theClass.propTypes.properties : null);
    }
  }
  if (propsShape !== null) {
    // TODO
    // first we create some AST and convert it... need to do this properly later
    const astProps = convertNestedObjectToAst(propsShape);
    const initialProps = moduleEnv.eval(astProps);
    setAbstractPropsUsingNestedObject(initialProps, propsShape, 'props', true);
    initialProps.intrinsicName = 'props';
    return initialProps;
  }
  return evaluator.createAbstractObject("props");
}

async function optimizeComponentWithPrepack(
  ast,
  moduleEnv,
  astComponent,
  moduleScope,
  bailOuts
) {
  // create an abstract props object
  const initialProps = createAbstractPropsObject(astComponent.scope, astComponent, moduleEnv);
  const prepackEvaluatedComponent = moduleEnv.eval(astComponent);
  const resolvedResult = await reconciler.renderAsDeepAsPossible(
    prepackEvaluatedComponent,
    initialProps,
    bailOuts
  );

  const node = serializer.serializeEvaluatedFunction(
    prepackEvaluatedComponent,
    [initialProps],
    resolvedResult
  );
  return convertToExpression(node);
}

async function scanAllJsxElementIdentifiers(jsxElementIdentifiers, ast, moduleEnv, moduleScope) {
  const elementIdentifiers = Array.from(jsxElementIdentifiers.values());
  for (let i = 0; i < elementIdentifiers.length; i++) {
    const elementIdentifier = elementIdentifiers[i];
    if (elementIdentifier !== null) {
      await optimizeComponentTree(ast, moduleEnv, elementIdentifier.astNode, moduleScope);
    }
  }
}

async function handleBailouts(bailOuts, ast, moduleEnv, moduleScope) {
  if (bailOuts.length > 0) {
    for (let i = 0; i < bailOuts.length; i++) {
      const bailOut = bailOuts[i];
      const component = moduleScope.assignments.get(bailOut);

      if (component !== undefined) {
        await optimizeComponentTree(ast, moduleEnv, component.astNode, moduleScope);
      }
    }
  }
}

let optimizedTrees = 0;
let processedCount = 0;

async function optimizeComponentTree(
  ast,
  moduleEnv,
  astComponent,
  moduleScope
) {
  if (astComponent == null || astComponent.type === undefined) {
    return;
  }
  if (astComponent.type === 'CallExpression') {
    const astArguments = astComponent.arguments;
    for (let i = 0; i < astArguments.length; i++) {
      await optimizeComponentTree(ast, moduleEnv, astArguments[i], moduleScope);
    }
    return;
  } else if (astComponent.type === 'Identifier') {
    const obj = moduleScope.assignments.get(astComponent.name);
    if (obj.astNode !== undefined) {
      await optimizeComponentTree(ast, moduleEnv, obj.astNode, moduleScope);
    } else {
      debugger;
    }
    return;
  } else if (astComponent.type === 'FunctionExpression' || astComponent.type === 'ArrowFunctionExpression') {
    const func = astComponent.func;
    if (func.return === null) {
      if (processedCount === 0) {
        throw new Error('Cannot find exported React component to optimize. Try simplifiying the exports.');
      }
      return;
    }
    // TODO: check the return is JSX ?
    if (func.return.type !== 'JSXElement') {
      debugger;
    }
  } else if (astComponent.type === 'ClassExpression' || astComponent.type === 'ClassDeclaration') {
    // TODO: check if it has render?
  } else {
    return;
  }
  processedCount++;
  try {
    const bailOuts = [];
    const optimizedAstComponent = await optimizeComponentWithPrepack(ast, moduleEnv, astComponent, moduleScope, bailOuts);
    astComponent.optimized = true;
    astComponent.optimizedReplacement = optimizedAstComponent;
    optimizedTrees++;
    await handleBailouts(bailOuts, ast, moduleEnv, moduleScope);
  } catch (e) {
    const name = astComponent.id ? astComponent.id.name : 'anonymous function';
    console.warn(`\nPrepack component bail-out on "${name}" due to:\n${e.stack}\n`);
    // find all direct child components in the tree of this component
    if ((astComponent.type === 'FunctionDeclaration' || astComponent.type === 'FunctionExpression') && astComponent.scope !== undefined) {
      await scanAllJsxElementIdentifiers(astComponent.scope.jsxElementIdentifiers, ast, moduleEnv, moduleScope);
    } else if (astComponent.type === 'ClassExpression') {
      // scan all class methods for now
      const bodyParts = astComponent.body.body;
      for (let i = 0; i < bodyParts.length; i++) {
        const bodyPart = bodyParts[i];
        if (bodyPart.type === 'ClassMethod' && bodyPart.scope !== undefined) {
          await scanAllJsxElementIdentifiers(bodyPart.scope.jsxElementIdentifiers, ast, moduleEnv, moduleScope);
        }
      }
    }
  }
}

module.exports = {
  optimizeComponentTree: optimizeComponentTree
};
