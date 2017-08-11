"use strict";

const fs = require("fs");
const t = require("babel-types");
const babylon = require("babylon");
const traverser = require("./traverser");
const evaluator = require("./evaluator");
const serializer = require("./serializer");
const reconciler = require("./reconciler");
const optimizer = require("./optimizer");

const cache = new Map();

const whitelist = {
  window: true,
  document: true
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
  externalModules
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
      externalModules
    );
  } else {
    debugger;
  }
}

function removeDuplicates(arr) {
  return Array.from(new Set(arr));
}

function cacheDataFromModuleScope(moduleName, moduleScope) {
  let defaultExport;
  const declarations = {};
  const externalModules = [];
  const assignmentKeys = Array.from(moduleScope.assignments.keys());
  const functionCalls = moduleScope.calls;

  assignmentKeys.forEach(assignmentKey => {
    const assignmentValue = moduleScope.assignments.get(assignmentKey);

    if (whitelist[assignmentKey] === true && moduleScope.parentScope === null) {
      // skip whitelist items
    } else if (
      assignmentKey === "require" &&
      moduleScope.parentScope === null
    ) {
      declarations.require = evaluator.createAbstractFunction("require");
      externalModules.push.apply(
        externalModules,
        removeDuplicates(
          assignmentValue.callSites.map(callSite => callSite.args[0])
        )
      );
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
        externalModules,
        functionCalls
      );
    }
  });

  cache.set(moduleName, {
    assignments: moduleScope.assignments,
    defaultExport: defaultExport,
    externalModules: externalModules,
    declarations: declarations
  });
}

function analyzeModule(moduleName, hasteMap) {
  const filename = hasteMap.get(moduleName);
  const content = fs.readFileSync(filename, "utf8");
  const ast = babylon.parse(content, {
    filename: filename,
    plugins: ["jsx", "flow"]
  });
  const moduleScope = traverser.createModuleScope();
  traverser.traverse(ast.program, traverser.Actions.Scan, moduleScope);

  cacheDataFromModuleScope(moduleName, moduleScope);
}

function compileComponentTreeWithPrepack(
  moduleEnv,
  originalAstComponent,
  fallbackCompileComponentTree
) {
  // create an abstract props object
  const initialProps = evaluator.createAbstractObject("props");
  let node;

  try {
    const prepackEvaluatedComponent = moduleEnv.eval(originalAstComponent);
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
  } catch (e) {
    // bail out
    console.warn("Bailed out of compiling component with Prepack");
    node = fallbackCompileComponentTree(originalAstComponent);
  }
  return convertToExpression(node);
}

// this is a slow implementation to do this, can be refactored to perform better
function constructExternalImports(externalModules, assignments) {
  const assignmentKeys = Array.from(assignments.keys());
  const moduleImports = externalModules.map(externalModule => {
    // find the externalModule in the assignments

    for (let i = 0; i < assignmentKeys.length; i++) {
      const assignmentKey = assignmentKeys[i];
      let assignment = assignments.get(assignmentKey);
      let pass = false;

      if (Array.isArray(assignment)) {
        assignment = traverser.handleMultipleValues(assignment);
      }
      if (assignment.type === 'FunctionCall') {
        if (assignment.identifier !== null && assignment.identifier.name === 'require') {
          if (assignment.args.length === 1 && assignment.args[0] === externalModule) {
            pass = true;
          }
        }
      } else if (assignment.type === 'AbstractUnknown' && assignment.crossModule === true) {
        pass = true;
      }
      if (pass === true) {
        return t.variableDeclaration('var',
        [t.variableDeclarator(t.identifier(assignmentKey), assignment.astNode)]
        );
      }
    }
  });
  return t.blockStatement(moduleImports);
}

function constructModuleExports(componentTree) {
  return t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(t.identifier("module"), t.identifier("exports")),
      componentTree
    )
  );
}

function convertToExpression(node) {
  if (node.type === "FunctionDeclaration") {
    node.type = "FunctionExpression";
  }
  return node;
}

function constructModule(
  moduleEnv,
  functionCalls,
  externalModules,
  assignments,
  defaultExport
) {
  const defaultExportComponent = defaultExport.astNode;

  const fallbackCompileComponentTree = astComponent =>
    optimizer.optimizeComponentTree(
      astComponent,
      assignments,
      externalModules,
      functionCalls,
      compileComponentTreeWithPrepack,
      fallbackCompileComponentTree
    );
  const componentTree = compileComponentTreeWithPrepack(
    moduleEnv,
    defaultExportComponent,
    fallbackCompileComponentTree
  );

  return t.blockStatement([
    constructExternalImports(externalModules, assignments),
    constructModuleExports(componentTree)
  ]);
}

function compileModule(moduleName) {
  if (cache.has(moduleName)) {
    const dataForModule = cache.get(moduleName);
    const assignments = dataForModule.assignments;
    const declarations = dataForModule.declarations;
    const externalModules = dataForModule.externalModules;
    const defaultExport = dataForModule.defaultExport;
    const functionCalls = dataForModule.functionCalls;
    const moduleEnv = new evaluator.ModuleEnvironment();
    // eval and declare all declarations
    Object.keys(declarations).forEach(declarationKey => {
      const declaration = declarations[declarationKey];
      // if the type is undefined, its most likely abstract
      if (declaration.type === undefined) {
        moduleEnv.declare(declarationKey, declaration);
      } else {
        const evaluation = moduleEnv.eval(declaration);
        moduleEnv.declare(declarationKey, evaluation);
      }
    });
    return constructModule(
      moduleEnv,
      functionCalls,
      externalModules,
      assignments,
      defaultExport
    );
  }
  return null;
}

module.exports = {
  analyzeModule: analyzeModule,
  compileModule: compileModule
};
