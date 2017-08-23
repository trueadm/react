"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const reconciler = require("./reconciler");
const serializer = require("./serializer");
const traverser = require("./traverser");
const Types = require("./types").Types;
const convertAccessorsToNestedObject = require('./types').convertAccessorsToNestedObject;
const convertNestedObjectToAst = require('./types').convertNestedObjectToAst;
const setAbstractPropsUsingNestedObject = require('./types').setAbstractPropsUsingNestedObject;

function convertToExpression(node) {
  if (node.type === "FunctionDeclaration") {
    node.type = "FunctionExpression";
  }
  return node;
}

function createAbstractPropsObject(scope, astComponent, moduleEnv) {
  const type = astComponent.type;
  let propsShape = null;

  // props is the first param of the function component
  if (type === 'FunctionExpression' || type === 'FunctionDeclaration') {
    const propsInScope = astComponent.func.params[0];
    if (propsInScope !== undefined) {
      const func = astComponent.func;
      propsShape = convertAccessorsToNestedObject(propsInScope.accessors, func.propTypes ? func.propTypes.properties : null);
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
      if (typeof bailOut === 'string') {
        const component = moduleScope.assignments.get(bailOut);
        
        if (component !== undefined) {
          await optimizeComponentTree(ast, moduleEnv, component.astNode, moduleScope);
        }
      } else {
        // deal with ast
        const componentScope = {
          deferredScopes: [],
          components: new Map(),
        };
        traverser.traverse(bailOut, traverser.Actions.FindComponents, componentScope);
        const newBailOuts = Array.from(componentScope.components.keys());
        handleBailouts(newBailOuts, ast, moduleEnv, moduleScope);
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
  } else if (astComponent.type === 'FunctionExpression' || astComponent.type === 'FunctionDeclaration' || astComponent.type === 'ArrowFunctionExpression') {
    const func = astComponent.func;
    if (func.return === null) {
      if (processedCount === 0) {
        throw new Error('Cannot find exported React component to optimize. Try simplifiying the exports.');
      }
      return;
    }
    // TODO: check the return is JSX ?
    if (func.return.type !== 'JSXElement' && func.return.type !== 'Array' && func.return.type !== 'String' && func.return.type !== 'Number') {
      debugger;
    }
  } else if (astComponent.type === 'ClassExpression' || astComponent.type === 'ClassDeclaration') {
    // TODO: check if it has render?
  } else {
    return;
  }
  const name = astComponent.id ? astComponent.id.name : 'anonymous function';
  processedCount++;
  try {
    const bailOuts = [];
    const optimizedAstComponent = await optimizeComponentWithPrepack(ast, moduleEnv, astComponent, moduleScope, bailOuts);
    astComponent.optimized = true;
    astComponent.optimizedReplacement = optimizedAstComponent;
    optimizedTrees++;
    console.log(`\nPrepack component successfully optimized "${name}"\n`);
    await handleBailouts(bailOuts, ast, moduleEnv, moduleScope);
  } catch (e) {
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
