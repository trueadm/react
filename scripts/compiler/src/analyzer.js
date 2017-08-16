"use strict";

const t = require("babel-types");
const evaluator = require("./evaluator");
const fs = require("fs");
const babylon = require("babylon");
const traverser = require("./traverser");

const whitelist = {
  window: true,
  document: true,
};

function toAst(node) {
  if (typeof node === "string") {
    return t.stringLiteral(node);
  } else {
    debugger;
  }
}

function handleAssignmentValue(
  assignmentValue,
  assignmentKey,
  declarations,
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
        // TODO:
        // we also need to remove the superClass or Prepack doesn't compile it?
        if (astNode.superClass !== null) {
          astNode.superClass = null;
        }
        declarations[assignmentKey] = assignmentValue.astNode;
        break;
      }
      case "FunctionCall": {
        const identifier = assignmentValue.identifier;

        if (identifier.type === "AbstractFunction") {
          if (identifier.name) {
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
          declarations[assignmentKey] = t.callExpression(
            t.identifier(identifier.name),
            assignmentValue.args.map(arg => toAst(arg))
          );
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
      case "Object": {
        declarations[assignmentKey] = assignmentValue.astNode;
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
      lastAssignmentValue,
      assignmentKey,
      declarations,
    );
  } else {
    debugger;
  }
}

function createPrepackMetadata(moduleScope) {
  let defaultExport;
  const declarations = {};
  const assignmentKeys = Array.from(moduleScope.assignments.keys());

  assignmentKeys.forEach(assignmentKey => {
    const assignmentValue = moduleScope.assignments.get(assignmentKey);

    if (whitelist[assignmentKey] === true && moduleScope.parentScope === null) {
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
        assignmentValue,
        assignmentKey,
        declarations,
      );
    }
  });
  return {
    defaultExport: defaultExport,
    declarations: declarations,
  };
}

function analyzeBundle(destinationBundlePath) {
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
  analyzeBundle: analyzeBundle,
};
