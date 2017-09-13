"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const fs = require("fs");
const babylon = require("babylon");
const traverser = require("./traverser");
const createMockReact = require("./mocks").createMockReact;
const createMockWindow = require("./mocks").createMockWindow;
const convertAccessorsToNestedObject = require("./types")
  .convertAccessorsToNestedObject;
const convertNestedObjectToAst = require("./types").convertNestedObjectToAst;
const setAbstractPropsUsingNestedObject = require("./types")
  .setAbstractPropsUsingNestedObject;

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

        if (declaration.func !== undefined) {
          evaluation.func = declaration.func;
        }
        if (declaration.class !== undefined) {
          evaluation.class = declaration.class;
        }
        moduleEnv.declare(declarationKey, evaluation);
      } catch (e) {
        moduleEnv.declare(declarationKey, evaluator.createAbstractValue(declarationKey));
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
        declarations[assignmentKey] = assignmentValue.astNode;
        break;
      }
      case "FunctionCall": {
        if (assignmentValue.accessedAsConstructor === true) {
          declarations[assignmentKey] = evaluator.createAbstractFunction(assignmentKey);
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
            console.warn(
              `Found a nondeterministic function call for "${identifier.name}" (treating as abstract)`
            );
          } else {
            console.warn(
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
        declarations[assignmentKey] = evaluator.createAbstractValue(
          assignmentKey
        );
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
    if (
      assignmentKey === "Array" ||
      assignmentKey === "Object" ||
      assignmentKey === "Promise" ||
      assignmentKey === "Date" ||
      assignmentKey === "Error" ||
      assignmentKey === "String" ||
      assignmentKey === "Number" ||
      assignmentKey === "RegExp" ||
      assignmentKey === "Symbol" ||
      assignmentKey === "Function" ||
      assignmentKey === "Boolean" ||
      assignmentKey === "eval" ||
      assignmentKey === "console" ||
      assignmentKey === "parseInt" ||
      assignmentKey === "parseFloat"
    ) {
      // NO-OP
    } else if (assignmentKey === "fbt") {
      const fbt = Array.isArray(assignmentValue)
        ? assignmentValue[0]
        : assignmentValue;
      handleAssignmentValue(moduleScope, fbt, "fbt", declarations, env);
    } else if (assignmentKey === "React") {
      declarations.React = createMockReact();
    } else if (assignmentKey === "window") {
      declarations.window = createMockWindow();
    } else if (assignmentKey === "document") {
      // TODO
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

  return Promise.resolve({
    ast: ast,
    prepackMetadata: createPrepackMetadata(moduleScope),
    destinationBundlePath: destinationBundlePath,
    moduleScope,
    source
  });
}

module.exports = {
  setupBundle: setupBundle
};
