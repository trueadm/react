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

function createAbstractPropsObject(scope, astComponent, moduleEnv) {
  const type = astComponent.type;
  let propsShape = null;

  // props is the first param of the function component
  if (type === 'FunctionExpression' || type === 'FunctionDeclaration') {
    const propsInScope = astComponent.func.params[0];
    if (propsInScope !== undefined) {
      propsShape = Array.from(propsInScope.accessors.keys());
    }
  } else if (type === 'ClassExpression' || type === 'ClassDeclaration') {
    const propsOnClass = astComponent.class.thisObject.accessors.get('props');
    if (propsOnClass !== undefined) {
      propsShape = Array.from(propsOnClass.accessors.keys());
    }
  }
  if (propsShape !== null) {
    // TODO
    // first we create some AST and convert it... need to do this properly later
    const astProps = t.objectExpression(
      propsShape.map(prop => t.objectProperty(t.identifier(prop), t.nullLiteral()))
    );
    const initialProps = moduleEnv.eval(astProps);
    propsShape.forEach(prop => {
      initialProps.properties.get(prop).descriptor.value = evaluator.createAbstractUnknown(`props.${prop}`);
    });
    initialProps.intrinsicName = 'props';
    return initialProps;
  }
  return evaluator.createAbstractObject("props");
}

async function optimizeComponentWithPrepack(
  ast,
  moduleEnv,
  astComponent,
  moduleScope
) {
  // create an abstract props object
  const initialProps = createAbstractPropsObject(astComponent.scope, astComponent, moduleEnv);
  const prepackEvaluatedComponent = moduleEnv.eval(astComponent);
  const resolvedResult = await reconciler.renderAsDeepAsPossible(
    prepackEvaluatedComponent,
    initialProps
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

async function optimizeComponentTree(
  ast,
  moduleEnv,
  astComponent,
  moduleScope
) {
  try {
    const optimizedAstComponent = await optimizeComponentWithPrepack(ast, moduleEnv, astComponent, moduleScope);
    astComponent.optimized = true;
    astComponent.optimizedReplacement = optimizedAstComponent;
  } catch (e) {
    console.warn(`\nPrepack component bail-out on "${astComponent.id.name}" due to:\n${e.stack}\n`);
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
