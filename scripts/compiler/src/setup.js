/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const fs = require("fs");
const babylon = require("babylon");
const traverser = require("./traverser");
const mocks = require("./mocks");
const {
  convertAccessorsToNestedObject,
  convertNestedObjectToAst,
  setAbstractPropsUsingNestedObject,
} = require("./types");

const blacklist = {
  Array: true,
  Object: true,
  Promise: true,
  Math: true,
  Date: true,
  Error: true,
  String: true,
  Number: true,
  RegExp: true,
  Symbol: true,
  Function: true,
  Boolean: true,
  eval: true,
  uneval: true,
  decodeURI: true,
  encodeURI: true,
  decodeURIComponent: true,
  encodeURIComponent: true,
  console: true,
  performance: true,
  debugger: true,
  isNaN: true,
  isFinite: true,
  parseInt: true,
  parseFloat: true,
  document: true,
  Element: true,
  Node: true
};

function setupPrepackEnvironment(moduleEnv, declarations) {
  // eval and declare all declarations
  Object.keys(declarations).forEach(declarationKey => {
    const declaration = declarations[declarationKey];
    // if the type is undefined, its most likely abstract
    if (declaration.type === undefined) {
      moduleEnv.declare(declarationKey, declaration);
    } else {
      try {
        const evaluation = moduleEnv.eval(declaration);
        // function component post eval stuff
        const func = declaration.func;
        if (func !== undefined) {
          evaluation.func = declaration.func;
          // TODO: I'm nto sure this is helping or actually doing anything, need to explore more
          // it was many used to stop cloneElement bail outs, but I've commented out copying of defaultProps out of cloneElement for now
          // which isn't right
          evaluation.properties.set(
            "defaultProps",
            evaluator.createAbstractObject("defaultProps")
          );
        }
        // class component post eval stuff
        const theClass = declaration.class;
        if (theClass !== undefined) {
          evaluation.class = theClass;
          if (theClass.defaultProps !== null) {
            try {
              evaluation.properties
                .get("prototype")
                .descriptor.value.properties.set(
                  "defaultProps",
                  moduleEnv.eval(theClass.defaultProps.astNode)
                );
            } catch (e) {
              // TODO: what do we do in this case?
              debugger;
            }
          }
        }
        moduleEnv.declare(declarationKey, evaluation);
      } catch (e) {
        moduleEnv.declare(
          declarationKey,
          evaluator.createAbstractValue(declarationKey)
        );
      }
    }
  });
  return moduleEnv;
}

function handleAssignmentValue(
  moduleScope,
  assignmentValue,
  assignmentKey,
  declarations,
  env
) {
  if (assignmentValue === null) {
    declarations[assignmentKey] = t.identifier("undefined");
  } else if (typeof assignmentValue === "string") {
    declarations[assignmentKey] = t.stringLiteral(assignmentValue);
  } else if (typeof assignmentValue === "number") {
    declarations[assignmentKey] = t.numericLiteral(assignmentValue);
  } else if (typeof assignmentValue === "boolean") {
    declarations[assignmentKey] = t.booleanLiteral(assignmentValue);
  } else if (assignmentValue.type !== undefined) {
    const type = assignmentValue.type;
    switch (type) {
      case "Function": {
        const astNode = assignmentValue.astNode;
        if (astNode === null) {
          // some mystery here, so return abstract unknown
          declarations[assignmentKey] = evaluator.createAbstractValue(
            assignmentKey
          );
        } else {
          declarations[assignmentKey] = astNode;
        }
        break;
      }
      case "Class": {
        let astNode = assignmentValue.astNode;
        // TODO:
        // if the astNode is a ClassDecleration, we need to make the astNode
        // a ClassExpression for Prepack to play ball with it
        if (astNode.type === "ClassDeclaration") {
          astNode.type = "ClassExpression";
        }
        declarations[assignmentKey] = astNode;
        break;
      }
      case "FunctionCall": {
        if (assignmentValue.accessedAsConstructor === true) {
          declarations[assignmentKey] = evaluator.createAbstractFunction(
            assignmentKey
          );
          break;
        }
        const identifier = assignmentValue.identifier;
        if (identifier.type === "AbstractFunction") {
          if (identifier.name) {
            // for requires, we can try and guess an abstract shape to help prepack
            // we do this by using the accessors (all the references to properties in the scope)
            // we can use our type conversion to work out the shape, conver to AST, then add values
            if (identifier.name === "require") {
              const accessors = assignmentValue.accessors;

              if (accessors !== undefined && accessors.size > 0) {
                const estimatedShape = convertAccessorsToNestedObject(
                  accessors,
                  null,
                  true
                );
                // small hack to make fbt better
                if (assignmentKey === "fbt") {
                  estimatedShape._ = "func_isRequired";
                  estimatedShape.param = "func_isRequired";
                }
                const estimatedShapeAst = convertNestedObjectToAst(
                  estimatedShape
                );
                let estimatedValue = env.eval(estimatedShapeAst);
                estimatedValue = setAbstractPropsUsingNestedObject(
                  estimatedValue,
                  estimatedShape,
                  assignmentKey,
                  true
                );
                estimatedValue.intrinsicName = assignmentKey;
                declarations[assignmentKey] = estimatedValue;
                break;
              }
            }
            // TODO bringing this in allows us to work ReactRedux etc, but it breaks for non pure functions
            // if (assignmentValue.astNode != null && identifier.name !== 'require') {
            //   declarations[assignmentKey] = assignmentValue.astNode;
            //   break;
            // }
            console.log(
              `Found a nondeterministic function call for "${identifier.name}" (treating as abstract)`
            );
          } else {
            console.log(
              `Found a nondeterministic function call (treating as abstract)`
            );
          }
          declarations[assignmentKey] = evaluator.createAbstractFunction(
            assignmentKey
          );
        } else {
          if (assignmentValue.identifier.type !== "AbstractValue") {
            declarations[assignmentKey] = assignmentValue.astNode;
          } else {
            declarations[assignmentKey] = evaluator.createAbstractFunction(
              assignmentKey
            );
          }
        }
        break;
      }
      case "Undefined": {
        declarations[assignmentKey] = t.identifier("undefined");
        break;
      }
      case "Null": {
        declarations[assignmentKey] = t.nullLiteral();
        break;
      }
      case "AbstractObject": {
        declarations[assignmentKey] = evaluator.createAbstractObject(
          assignmentKey
        );
        break;
      }
      case "AbstractValue": {
        if (assignmentValue.astNode != null) {
          declarations[assignmentKey] = assignmentValue.astNode;
        } else {
          declarations[assignmentKey] = evaluator.createAbstractValue(
            assignmentKey
          );
        }
        break;
      }
      case "AbstractObjectOrUndefined": {
        declarations[assignmentKey] = evaluator.createAbstractObjectOrUndefined(
          assignmentKey
        );
        break;
      }
      case "AbstractFunction": {
        declarations[assignmentKey] = evaluator.createAbstractFunction(
          assignmentKey
        );
        break;
      }
      case "Object": {
        const astNode = assignmentValue.astNode;
        if (astNode !== null) {
          declarations[assignmentKey] = astNode;
        } else {
          declarations[assignmentKey] = evaluator.createAbstractObject(
            assignmentKey
          );
        }
        break;
      }
      case "SequenceExpression":
      case "UnaryExpression":
      case "LogicExpression":
      case "ConditionalExpression":
      case "MathExpression": {
        if (assignmentValue.astNode !== null) {
          declarations[assignmentKey] = assignmentValue.astNode;
        } else {
          declarations[assignmentKey] = evaluator.createAbstractValue(
            assignmentKey
          );
        }
        break;
      }
      case "Array": {
        if (assignmentValue.astNode !== null) {
          declarations[assignmentKey] = assignmentValue.astNode;
        } else {
          declarations[assignmentKey] = evaluator.createAbstractArray(
            assignmentKey
          );
        }
        break;
      }
      case "JSXElement": {
        if (assignmentValue.astNode !== null) {
          declarations[assignmentKey] = assignmentValue.astNode;
        } else {
          debugger;
        }
        break;
      }
      default: {
        debugger;
      }
    }
  } else if (Array.isArray(assignmentValue)) {
    // if it has multiple asssigns, we need to work out how safe this is to use
    // this is a big TODO really
    // for now we can just use the last value
    const lastAssignmentValue = assignmentValue[assignmentValue.length - 1];
    handleAssignmentValue(
      moduleScope,
      lastAssignmentValue,
      assignmentKey,
      declarations,
      env
    );
  } else {
    debugger;
  }
}

function createPrepackMetadata(moduleScope) {
  let defaultExport;
  const declarations = {};
  const assignmentKeys = Array.from(moduleScope.assignments.keys());
  const env = new evaluator.ModuleEnvironment();

  assignmentKeys.forEach(assignmentKey => {
    const assignmentValue = moduleScope.assignments.get(assignmentKey);
    if (blacklist[assignmentKey] === true) {
      // NO-OP
    } else if (assignmentKey === "React") {
      declarations.React = mocks.createMockReact(env);
    } else if (assignmentKey === "Redux") {
      declarations.Redux = mocks.createMockRedux(env);
    } else if (assignmentKey === "ReactRedux") {
      declarations.ReactRedux = mocks.createMockReactRedux(env);
    } else if (assignmentKey === "window") {
      declarations.window = mocks.createMockWindow();
    } else if (assignmentKey === "ix" || assignmentKey === "cx") {
      declarations[assignmentKey] = evaluator.createAbstractFunction(
        assignmentKey
      );
    } else if (assignmentKey === "JSResource") {
      declarations.JSResource = evaluator.createAbstractFunction("JSResource");
    } else if (
      assignmentKey === "require" &&
      moduleScope.parentScope === null
    ) {
      declarations.require = evaluator.createAbstractFunction("require");
    } else if (assignmentKey === "module" && moduleScope.parentScope === null) {
      const exportValues = assignmentValue.properties.get("exports");

      if (exportValues.length === 0) {
        throw new Error('Entry file does not contain a valid "module.exports"');
      }
      if (Array.isArray(exportValues)) {
        // if module.exports has been assigned, we take the last assignment
        defaultExport = exportValues[exportValues.length - 1];
      } else {
        // if module.exports has been used as an object, we take its values
        defaultExport = Array.from(exportValues.properties.values());
      }
      if (Array.isArray(defaultExport)) {
        throw new Error(
          'Entry file has a dynamic "module.exports" value that cannot be statically resolved'
        );
      }
    } else {
      handleAssignmentValue(
        moduleScope,
        assignmentValue,
        assignmentKey,
        declarations,
        env
      );
    }
  });
  setupPrepackEnvironment(env, declarations);
  return {
    defaultExport: defaultExport,
    env: env
  };
}

function setupBundle(destinationBundlePath) {
  const source = fs.readFileSync(destinationBundlePath, "utf8");
  return setupSource(source, destinationBundlePath);
}

function setupSource(source, destinationBundlePath) {
  const ast = babylon.parse(source, {
    filename: destinationBundlePath,
    plugins: ["jsx", "flow"]
  });
  const moduleScope = traverser.createModuleScope();
  traverser.traverse(
    ast.program,
    traverser.Actions.ScanTopLevelScope,
    moduleScope
  );
  mocks.scanMocks(moduleScope);

  return Promise.resolve({
    ast: ast,
    prepackMetadata: createPrepackMetadata(moduleScope),
    destinationBundlePath: destinationBundlePath,
    moduleScope
  });
}

module.exports = {
  setupBundle,
  setupSource
};
