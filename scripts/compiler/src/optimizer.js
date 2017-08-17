"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const reconciler = require("./reconciler");
const serializer = require("./serializer");

function convertToExpression(node) {
  if (node.type === "FunctionDeclaration") {
    node.type = "FunctionExpression";
  }
  return node;
}

function createAbstractPropsObject(scope) {
  const propsInScope = scope.accessors.get('props');
  debugger;
  // const propsShape = Array.from
  // TODO
  // first we create some AST and convert it... need to do this properly later
  debugger;
  const astProps = t.objectExpression(
  );
}

function optimizeComponentWithPrepack(
  ast,
  moduleEnv,
  astComponent,
  moduleScope
) {
  // create an abstract props object
  const initialProps = createAbstractPropsObject(astComponent.scope);
  // const initialProps = evaluator.createAbstractObject("props");
  // const astTest = t.objectExpression([t.objectProperty(t.identifier('x'), t.nullLiteral())]);
  // const initialProps = moduleEnv.eval(astTest);
  // initialProps.properties.get('x').descriptor.value = evaluator.createAbstractUnknown("x");
  // debugger;
  // initialProps.intrinsicName = 'props';
  const prepackEvaluatedComponent = moduleEnv.eval(astComponent);
  const resolvedResult = reconciler.renderAsDeepAsPossible(
    prepackEvaluatedComponent,
    initialProps,
    function fallback(fallbackAstComponent) {
      optimizeComponentTree(ast, moduleEnv, fallbackAstComponent, moduleScope);
    }
  );

  const node = serializer.serializeEvaluatedFunction(
    prepackEvaluatedComponent,
    [initialProps],
    resolvedResult
  );
  return convertToExpression(node);
}

function scanAllJsxElementIdentifiers(jsxElementIdentifiers, ast, moduleEnv, moduleScope) {
  const elementIdentifiers = Array.from(jsxElementIdentifiers.values());
  for (let i = 0; i < elementIdentifiers.length; i++) {
    const elementIdentifier = elementIdentifiers[i];
    if (elementIdentifier !== null) {
      optimizeComponentTree(ast, moduleEnv, elementIdentifier.astNode, moduleScope);
    }
  }
}

function optimizeComponentTree(
  ast,
  moduleEnv,
  astComponent,
  moduleScope
) {
  try {
    const optimizedAstComponent = optimizeComponentWithPrepack(ast, moduleEnv, astComponent, moduleScope);
    astComponent.optimized = true;
    astComponent.optimizedReplacement = optimizedAstComponent;
  } catch (e) {
    console.warn(`\nPrepack component bail-out on "${astComponent.id.name}" due to:\n${e.stack}\n`);
    // find all direct child components in the tree of this component
    let jsxElementIdentifiers;
    if ((astComponent.type === 'FunctionDeclaration' || astComponent.type === 'FunctionExpression') && astComponent.scope !== undefined) {
      scanAllJsxElementIdentifiers(astComponent.scope.jsxElementIdentifiers, ast, moduleEnv, moduleScope);
    } else if (astComponent.type === 'ClassExpression') {
      // scan all class methods for now
      astComponent.body.body.forEach(bodyPart => {
        if (bodyPart.type === 'ClassMethod' && bodyPart.scope !== undefined) {
          scanAllJsxElementIdentifiers(bodyPart.scope.jsxElementIdentifiers, ast, moduleEnv, moduleScope);
        }
      });
    }
  }
}

module.exports = {
  optimizeComponentTree: optimizeComponentTree
};
