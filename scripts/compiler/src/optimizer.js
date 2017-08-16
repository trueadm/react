"use strict";

const evaluator = require("./evaluator");
const reconciler = require("./reconciler");
const serializer = require("./serializer");

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
    fallbackCompileComponentTree
  );

  node = serializer.serializeEvaluatedFunction(
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
    const optimizedComponent = optimizeComponentWithPrepack(ast, moduleEnv, astComponent);
    debugger;
  } catch (e) {
    console.warn("Bailed out of compiling component with Prepack");
  }
}

module.exports = {
  optimizeComponentTree: optimizeComponentTree
};
