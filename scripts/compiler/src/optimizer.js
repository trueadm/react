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
  
  if (keys.length > 0) {
    const object = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (propTypes != null && propTypes.has(key)) {
        object[key] = propTypes.get(key);
      } else {
        object[key] = Types.ANY;
      }
    }
    return object;
  }
  return Types.ANY;
}

function convertNestedObjectToAst(object) {
  return t.objectExpression(
    Object.keys(object).map(key => {
      const value = object[key];
      switch (value) {
        case Types.ANY:
        case Types.ARRAY:
        case Types.OBJECT:
          return t.objectProperty(t.identifier(key), t.nullLiteral());
        default:
          debugger;
      }
    })
  );
}

function setAbstractPropsUsingNestedObject(ast, object, prefix, root) {
  const properties = ast.properties;
  Object.keys(object).forEach(key => {
    const value = object[key];
    const newPrefix = `${prefix}.${key}`;

    if (value === Types.ANY) {
      properties.get(key).descriptor.value = evaluator.createAbstractUnknown(newPrefix);
    } else if (value === Types.ARRAY) {
      properties.get(key).descriptor.value = evaluator.createAbstractArray(newPrefix);
    }
  });
}

// function convertAccessorsToNestedObject(accessors) {
//   const keys = Array.from(accessors.keys());
  
//   if (keys.length > 0) {
//     const object = {};
//     for (let i = 0; i < keys.length; i++) {
//       const key = keys[i];
//       const value = accessors.get(key).accessors;

//       if (value.size === 0) {
//         object[key] = PROP_ABSTRACT_UNKNOWN;
//         return PROP_ABSTRACT_OBJECT;
//       } else {
//         object[key] = convertAccessorsToNestedObject(value);
//       }
//     }
//     return object;
//   }
//   return PROP_ABSTRACT_UNKNOWN;
// }

// The below doesn't work for falsey/truthy nature of abstractObject
// const PROP_ABSTRACT_UNKNOWN = 1;
// const PROP_ABSTRACT_OBJECT = 2;

// function convertAccessorsToNestedObject(accessors) {
//   const keys = Array.from(accessors.keys());
  
//   if (keys.length > 0) {
//     const object = {};
//     for (let i = 0; i < keys.length; i++) {
//       const key = keys[i];
//       const value = accessors.get(key).accessors;

//       if (value.size === 0) {
//         object[key] = PROP_ABSTRACT_UNKNOWN;
//         return PROP_ABSTRACT_OBJECT;
//       } else {
//         object[key] = convertAccessorsToNestedObject(value);
//       }
//     }
//     return object;
//   }
//   return PROP_ABSTRACT_UNKNOWN;
// }

// function convertNestedObjectToAst(object) {
//   return t.objectExpression(
//     Object.keys(object).map(key => {
//       const value = object[key];
//       if (value === PROP_ABSTRACT_UNKNOWN || value === PROP_ABSTRACT_OBJECT) {
//         return t.objectProperty(t.identifier(key), t.nullLiteral());
//       } else {
//         return t.objectProperty(t.identifier(key), convertNestedObjectToAst(value));
//       }
//     })
//   );
// }

// function setAbstractPropsUsingNestedObject(ast, object, prefix, root) {
//   const properties = ast.properties;
//   Object.keys(object).forEach(key => {
//     const value = object[key];
//     const newPrefix = `${prefix}.${key}`;

//     if (value === PROP_ABSTRACT_UNKNOWN) {
//       properties.get(key).descriptor.value = evaluator.createAbstractUnknown(newPrefix);
//     } else if (value === PROP_ABSTRACT_OBJECT) {
//       properties.get(key).descriptor.value = evaluator.createAbstractObject(newPrefix);
//     } else {
//       setAbstractPropsUsingNestedObject(
//         properties.get(key).descriptor.value,
//         value,
//         newPrefix,
//         false
//       );
//     }
//   });
// }

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
    const propsOnClass = astComponent.class.thisObject.accessors.get('props');
    if (propsOnClass !== undefined) {
      propsShape = convertAccessorsToNestedObject(propsOnClass.accessors);
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

async function optimizeComponentTree(
  ast,
  moduleEnv,
  astComponent,
  moduleScope
) {
  try {
    const bailOuts = [];
    const optimizedAstComponent = await optimizeComponentWithPrepack(ast, moduleEnv, astComponent, moduleScope, bailOuts);
    astComponent.optimized = true;
    astComponent.optimizedReplacement = optimizedAstComponent;
    await handleBailouts(bailOuts, ast, moduleEnv, moduleScope);
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
