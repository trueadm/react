"use strict";

const evaluator = require("./evaluator");
const reconciler = require("./reconciler");
const serializer = require("./serializer");

function convertToExpression(node) {
  if (node.type === "FunctionDeclaration") {
    node.type = "FunctionExpression";
  }
  return node;
}

function optimizeComponentWithPrepack(
  ast,
  moduleEnv,
  astComponent
) {
  // create an abstract props object
  const initialProps = evaluator.createAbstractObject("props");
  const prepackEvaluatedComponent = moduleEnv.eval(astComponent);
  const resolvedResult = reconciler.renderAsDeepAsPossible(
    prepackEvaluatedComponent,
    initialProps,
    optimizeComponentTree
  );

  const node = serializer.serializeEvaluatedFunction(
    prepackEvaluatedComponent,
    [initialProps],
    resolvedResult
  );
  return convertToExpression(node);
}

function optimizeComponentTree(
  ast,
  moduleEnv,
  astComponent,
) {
  try {
    const optimizedAstComponent = optimizeComponentWithPrepack(ast, moduleEnv, astComponent);
    astComponent.optimized = true;
    astComponent.optimizedReplacement = optimizedAstComponent;
  } catch (e) {
    console.warn("Bailed out of compiling component with Prepack");
  }
}

module.exports = {
  optimizeComponentTree: optimizeComponentTree
};
