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

function createAbstractPropsObject(scope, astComponent, moduleEnv, rootConfig) {
  const type = astComponent.type;
  let propsShape = null;

  // props is the first param of the function component
  if (type === 'ArrowFunctionExpression' || type === 'FunctionExpression' || type === 'FunctionDeclaration') {
    const propsInScope = astComponent.func.params[0];
    if (propsInScope !== undefined) {
      const func = astComponent.func;
      propsShape = convertAccessorsToNestedObject(propsInScope.accessors, func.propTypes ? func.propTypes.properties : null, false);
    }
  } else if (type === 'ClassExpression' || type === 'ClassDeclaration') {
    const theClass = astComponent.class;
    const propsOnClass = theClass.thisObject.accessors.get('props');
    if (propsOnClass !== undefined) {
      propsShape = convertAccessorsToNestedObject(propsOnClass.accessors, theClass.propTypes ? theClass.propTypes.properties : null, false);
    }
  }
  // add children to propsShape as we should assume it might always be there
  propsShape = Object.assign({children: 'any'}, propsShape || {});
  // first we create some AST and convert it... need to do this properly later
  const astProps = convertNestedObjectToAst(propsShape);
  let initialProps = moduleEnv.eval(astProps);
  initialProps = setAbstractPropsUsingNestedObject(initialProps, propsShape, 'this.props', true);
  initialProps.intrinsicName = 'props';
  return initialProps;
}

function createRootConfig() {
  return {
    useClassComponent: false,
    state: null,
  };
}

async function optimizeComponentWithPrepack(
  ast,
  moduleEnv,
  astComponent,
  moduleScope,
  source
) {
  // create an abstract props object
  const rootConfig = createRootConfig();
  const initialProps = createAbstractPropsObject(astComponent.scope, astComponent, moduleEnv);
  const prepackEvaluatedComponent = moduleEnv.eval(astComponent);
  if (astComponent.func !== undefined) {
    prepackEvaluatedComponent.func = astComponent.func;
  }
  if (astComponent.class !== undefined) {
    prepackEvaluatedComponent.class = astComponent.class;
  }  
  const resolvedResult = await reconciler.renderAsDeepAsPossible(
    prepackEvaluatedComponent,
    initialProps,
    rootConfig
  );
  const node = serializer.serializeEvaluatedFunction(
    prepackEvaluatedComponent,
    [initialProps],
    resolvedResult,
    rootConfig,
    source
  );
  return convertToExpression(node);
}

let optimizedTrees = 0;
let processedCount = 0;
const alreadyTried = new Map();

async function findNonOptimizedComponents(ast, astComponent, moduleEnv, moduleScope, source) {
  // scan the optimized component for further components
  const componentScope = {
    deferredScopes: [],
    components: new Map(),
  };
  traverser.traverse(astComponent, traverser.Actions.FindComponents, componentScope, source);
  const potentialBailOuts = Array.from(componentScope.components.keys());
  for (let i = 0; i < potentialBailOuts.length; i++) {
    const potentialBailOut = potentialBailOuts[i];
    const component = moduleScope.assignments.get(potentialBailOut);

    if (component !== undefined) {
      await optimizeComponentTree(ast, moduleEnv, component.astNode, moduleScope, source);
    }
  }
}

async function optimizeComponentTree(
  ast,
  moduleEnv,
  astComponent,
  moduleScope,
  source
) {
  if (astComponent == null || astComponent.type === undefined) {
    return;
  }
  if (astComponent.type === 'CallExpression') {
    const astArguments = astComponent.arguments;
    for (let i = 0; i < astArguments.length; i++) {
      await optimizeComponentTree(ast, moduleEnv, astArguments[i], moduleScope, source);
    }
    return;
  } else if (astComponent.type === 'Identifier') {
    const obj = moduleScope.assignments.get(astComponent.name);
    if (obj.astNode !== undefined) {
      await optimizeComponentTree(ast, moduleEnv, obj.astNode, moduleScope, source);
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
      // debugger;
    }
  } else if (astComponent.type === 'ClassExpression' || astComponent.type === 'ClassDeclaration') {
    // TODO: check if it has render?
  } else {
    return;
  }
  let name = astComponent.id ? astComponent.id.name : null;
  if (name === null) {
    if (astComponent.func.name) {
      name = astComponent.func.name;
    } else {
      name = 'unknown name';
    }
  }
  if (alreadyTried.has(name) === false) {
    alreadyTried.set(name, true);
    processedCount++;
    try {
      const optimizedAstComponent = await optimizeComponentWithPrepack(ast, moduleEnv, astComponent, moduleScope, source);
      astComponent.optimized = true;
      astComponent.optimizedReplacement = optimizedAstComponent;
      optimizedTrees++;
      await findNonOptimizedComponents(ast, optimizedAstComponent, moduleEnv, moduleScope, source);
      console.log(`Optimized component "${name}"\n`);
    } catch (e) {
      if (e.stack.indexOf('not yet supported on abstract value props') !== -1) {
        console.warn(`\nPrepack component bail-out on "${name}". This is likely due to lack of Flow types for props or React component propTypes.\n`);
      } else {
        console.warn(`\nPrepack component bail-out on "${name}" due to:\n${e.stack}\n`);
      }
      // find all direct child components in the tree of this component
      await findNonOptimizedComponents(ast, astComponent, moduleEnv, moduleScope, source);
    }
  } else {
    console.log(`Found component "${name}" but has already optimized this component before.`)
  }
}

function getOptimizedTrees() {
  return optimizedTrees;
}

module.exports = {
  optimizeComponentTree: optimizeComponentTree,
  getOptimizedTrees: getOptimizedTrees,
};
