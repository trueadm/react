"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const fs = require("fs");
const babylon = require("babylon");
const traverser = require("./traverser");
const createMockReact = require("./mocks").createMockReact;
const convertAccessorsToNestedObject = require('./types').convertAccessorsToNestedObject;
const convertNestedObjectToAst = require('./types').convertNestedObjectToAst;
const setAbstractPropsUsingNestedObject = require('./types').setAbstractPropsUsingNestedObject;

const whitelist = {
  window: true,
  document: true,
};

function toAst(node) {
  if (typeof node === "string") {
    return t.stringLiteral(node);
  } else if (node.astNode != null) {
    return node.astNode;
  } else {
    debugger;
  }
}

function setupPrepackEnvironment(moduleEnv, declarations) {
  // eval and declare all declarations
  Object.keys(declarations).forEach(declarationKey => {
    const declaration = declarations[declarationKey];
    // if the type is undefined, its most likely abstract
    if (declaration.type === undefined) {
      moduleEnv.declare(declarationKey, declaration);
    } else {
      const evaluation = moduleEnv.eval(declaration);
      // copy over the original func so we can access it in Prepack later for defaultProps
      if (declaration.func !== undefined) {
        evaluation.func = declaration.func;
      }
      moduleEnv.declare(declarationKey, evaluation);
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
          declarations[assignmentKey] = evaluator.createAbstractUnknown(
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
        const identifier = assignmentValue.identifier;

        if (identifier.type === "AbstractFunction") {
          if (identifier.name) {
            // for requires, we can try and guess an abstract shape to help prepack
            // we do this by using the accessors (all the references to properties in the scope)
            // we can use our type conversion to work out the shape, conver to AST, then add values
            if (identifier.name === 'require') {
              const accessors = assignmentValue.accessors;

              if (accessors !== undefined && accessors.size > 0) {
                const estimatedShape = convertAccessorsToNestedObject(accessors, null, true);
                const estimatedShapeAst = convertNestedObjectToAst(estimatedShape);
                const estimatedValue = env.eval(estimatedShapeAst);
                setAbstractPropsUsingNestedObject(estimatedValue, estimatedShape, assignmentKey, true);
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
          if (assignmentValue.identifier.type !== 'AbstractUnknown') {
            declarations[assignmentKey] = assignmentValue.astNode;
          } else {
            declarations[assignmentKey] = evaluator.createAbstractFunction();
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
      case "AbstractUnknown": {
        declarations[assignmentKey] = evaluator.createAbstractUnknown(
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
      case "LogicExpression": {
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
          declarations[assignmentKey] = evaluator.createAbstractObject(assignmentKey);
        }
        break;
      }
      case "MathExpression": {
        declarations[assignmentKey] = evaluator.createAbstractUnknown(
          assignmentKey
        );
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

    if (assignmentKey === '_objectWithoutProperties') {
      declarations._objectWithoutProperties = evaluator.createAbstractFunction('_objectWithoutProperties');
    } else if (assignmentKey === 'fbt') {
      const fbt = Array.isArray(assignmentValue) ? assignmentValue[0] : assignmentValue;
      handleAssignmentValue(moduleScope, fbt, 'fbt', declarations, env);
    } else if (assignmentKey === 'React') {
      declarations.React = createMockReact();
    } else if (whitelist[assignmentKey] === true && moduleScope.parentScope === null) {
      // skip whitelist items
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
    env: env,
  };
}

function setupBundle(destinationBundlePath) {
  const content = fs.readFileSync(destinationBundlePath, "utf8");
  const ast = babylon.parse(content, {
    filename: destinationBundlePath,
    plugins: ["jsx", "flow"]
  });
  const moduleScope = traverser.createModuleScope();
  traverser.traverse(ast.program, traverser.Actions.ScanTopLevelScope, moduleScope);

  return Promise.resolve({
    ast: ast,
    prepackMetadata: createPrepackMetadata(moduleScope),
    destinationBundlePath: destinationBundlePath,
    moduleScope,
  });
}

module.exports = {
  setupBundle: setupBundle,
};
