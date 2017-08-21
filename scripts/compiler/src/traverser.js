"use strict";

const PropTypes = require("./types").Types;

const Actions = {
  ScanTopLevelScope: "ScanTopLevelScope",
  ScanInnerScope: "ScanInnerScope",
  ReplaceWithOptimized: "ReplaceWithOptimized"
};

const Types = {
  Class: "Class",
  Function: "Function",
  FunctionCall: "FunctionCall",
  Object: "Object",
  Array: "Array",
  Scope: "Scope",
  Identifier: "Identifier",
  MathExpression: "MathExpression",
  LogicExpression: "LogicExpression",
  UnaryExpression: "UnaryExpression",
  ConditionalExpression: "ConditionalExpression",
  Undefined: "Undefined",
  Null: "Null",
  AbstractObject: "AbstractObject",
  AbstractFunction: "AbstractFunction",
  AbstractUnknown: "AbstractUnknown"
};

const propTypes = createObject(null, {
  string: PropTypes.STRING,
  array: PropTypes.ARRAY,
  object: PropTypes.OBJECT,
  number: PropTypes.NUMBER,
  bool: PropTypes.BOOL,
  func: PropTypes.FUNC,
  symbol: PropTypes.SYMBOL,
  any: PropTypes.ANY,
  element: PropTypes.ELEMENT,
  node: PropTypes.NODE
});

function createMathExpression(left, right, operator) {
  return {
    action: null,
    left: left,
    operator: operator,
    right: right,
    type: Types.MathExpression
  };
}

function createLogicExpression(left, right, operator) {
  return {
    action: null,
    left: left,
    operator: operator,
    right: right,
    type: Types.LogicExpression
  };
}

function createUnaryExpression(argument, operator) {
  return {
    argument: argument,
    action: null,
    operator: operator,
    type: Types.UnaryExpression
  };
}

function createConditionalExpression(alternate, consequent, test) {
  return {
    alternate: alternate,
    action: null,
    consequent: consequent,
    test: test,
    type: Types.ConditionalExpression
  };
}

function createUndefined() {
  return {
    action: null,
    type: Types.Undefined
  };
}

function createNull() {
  return {
    action: null,
    type: Types.Null
  };
}

function createIdentifier() {
  return {
    action: null,
    type: Types.Identifier
  };
}

function createAbstractObject() {
  return {
    action: null,
    type: Types.AbstractObject
  };
}

function createAbstractUnknown(crossModule) {
  return {
    action: null,
    crossModule: crossModule,
    type: Types.AbstractUnknown
  };
}

function createAbstractFunction(name) {
  return {
    action: null,
    callSites: [],
    name: name,
    type: Types.AbstractFunction
  };
}

function createFunction(name, astNode, scope) {
  return {
    action: null,
    astNode: astNode,
    callSites: [],
    name: name,
    params: [],
    properties: createObject(),
    scope: scope,
    type: Types.Function
  };
}

function createClass(name, astNode, superIdentifier, scope) {
  return {
    action: null,
    type: Types.Class,
    astNode: astNode,
    name: name,
    scope: scope,
    superIdentifier: superIdentifier,
    thisObject: createObject(null)
  };
}

function createFunctionCall(identifier, astNode) {
  return {
    action: null,
    astNode: astNode,
    type: Types.FunctionCall,
    identifier: identifier,
    args: []
  };
}

function createScope(assignments) {
  const scope = {
    action: null,
    assignments: new Map(),
    calls: [],
    deferredScopes: [],
    jsxElementIdentifiers: new Map(),
    parentScope: null,
    type: Types.Scope
  };
  if (assignments != null) {
    Object.keys(assignments).forEach(assignment =>
      assign(scope, "assignments", assignment, assignments[assignment])
    );
  }
  return scope;
}

function createObject(astNode, properties) {
  const object = {
    accessors: new Map(),
    action: null,
    astNode: astNode,
    type: Types.Object,
    properties: new Map()
  };
  if (properties != null) {
    Object.keys(properties).forEach(property =>
      assign(object, "properties", property, properties[property])
    );
  }
  return object;
}

function createArray(astNode, properties) {
  const object = {
    accessors: new Map(),
    action: null,
    astNode: astNode,
    type: Types.Array,
    properties: new Map()
  };
  if (properties != null) {
    Object.keys(properties).forEach(property =>
      assign(object, "properties", property, properties[property])
    );
  }
  return object;
}

function createModuleScope() {
  return createScope({
    module: createObject(null, {
      exports: createObject(null)
    }),
    require: createAbstractFunction("require"),
    window: createAbstractObject(),
    document: createAbstractObject(),
    Object: createAbstractObject(),
    Math: createAbstractObject(),
    Date: createAbstractObject(),
    performance: createAbstractObject(),
    console: createAbstractObject(),
    debugger: createAbstractFunction(),
  });
}

function assign(subject, topic, name, value) {
  if (subject[topic].has(name)) {
    const previousValue = subject[topic].get(name);

    if (Array.isArray(previousValue)) {
      previousValue.push(value);
    } else {
      const newValue = [previousValue, value];
      subject[topic].set(name, newValue);
    }
  } else {
    subject[topic].set(name, value);
  }
}

function traverse(node, action, scope) {
  if (node === undefined || node === null) {
    return;
  }
  switch (node.type) {
    case "BlockStatement": {
      const body = node.body;
      for (let i = 0; i < body.length; i++) {
        traverse(body[i], action, scope);
      }
      break;
    }
    case "ReturnStatement": {
      traverse(node.argument, action, scope);
      break;
    }
    case "JSXElement": {
      const astOpeningElement = node.openingElement;
      const astName = astOpeningElement.name;
      const name = getNameFromAst(astName);
      const isReactComponent = name[0].toUpperCase() === name[0];
      if (isReactComponent === true) {
        scope.jsxElementIdentifiers.set(
          name,
          getOrSetValueFromAst(astName, scope, action)
        );
      }
      const astAttributes = astOpeningElement.attributes;
      for (let i = 0; i < astAttributes.length; i++) {
        traverse(astAttributes[i], action, scope);
      }
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        traverse(children[i], action, scope);
      }
      break;
    }
    case "JSXAttribute": {
      traverse(node.name, action, scope);
      traverse(node.value, action, scope);
      break;
    }
    case "JSXSpreadAttribute": {
      traverse(node.argument, action, scope);
      break;
    }
    case "JSXExpressionContainer":
    case "ExpressionStatement": {
      const expressionNode = traverse(node.expression, action, scope);
      if (expressionNode !== undefined) {
        node.expression = expressionNode;
      }
      break;
    }
    case "MemberExpression": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        const astObject = node.object;
        const astProperty = node.property;
        // we don't actually need to get or set anything, we just need to register the accesor
        // in case the member is a param
        getOrSetValueFromAst(
          astProperty,
          getOrSetValueFromAst(astObject, scope, action),
          action
        );
      } else {
        traverse(node.object, action, scope);
        traverse(node.property, action, scope);
      }
      break;
    }
    case "CallExpression": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        callFunction(node, node.callee, node.arguments, action, scope);
      }
      break;
    }
    case "VariableDeclaration": {
      const declarations = node.declarations;
      for (let i = 0; i < declarations.length; i++) {
        traverse(declarations[i], action, scope);
      }
      break;
    }
    case "VariableDeclarator": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        declareVariable(node.id, node.init, action, scope);
      } else {
        traverse(node.id, action, scope);
        const nodeInit = traverse(node.init, action, scope);
        if (nodeInit !== undefined) {
          node.init = nodeInit;
        }
      }
      break;
    }
    case "ForStatement": {
      traverse(node.init, action, scope);
      traverse(node.test, action, scope);
      traverse(node.update, action, scope);
      traverse(node.body, action, scope);
      break;
    }
    case "ForInStatement": {
      traverse(node.left, action, scope);
      traverse(node.right, action, scope);
      traverse(node.body, action, scope);
      break;
    }
    case "BinaryExpression": {
      traverse(node.left, action, scope);
      traverse(node.right, action, scope);
      break;
    }
    case "UpdateExpression": {
      traverse(node.argument, action, scope);
      break;
    }
    case "ArrowFunctionExpression": {
      traverse(node.id, action, scope);
      traverse(node.body, action, scope);
      break;
    }
    case "DoWhileStatement": {
      traverse(node.body, action, scope);
      traverse(node.test, action, scope);
      break;
    }
    case "WhileStatement": {
      traverse(node.body, action, scope);
      traverse(node.test, action, scope);
      break;
    }
    case "IfStatement": {
      traverse(node.test, action, scope);
      traverse(node.consequent, action, scope);
      traverse(node.alternate, action, scope);
      break;
    }
    case "FunctionExpression": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        declareFunction(node, node.id, node.params, node.body, action, scope, false);
      } else if (action === Actions.ReplaceWithOptimized && node.optimized === true) {
        return node.optimizedReplacement;
      } else {
        traverse(node.body, action, scope);
      }
      break;
    }
    case "SwitchStatement": {
      traverse(node.discriminant, action, scope);
      const cases = node.cases;
      for (let i = 0; i < cases.length; i++) {
        traverse(cases[i], action, scope);
      }
      break;
    }
    case "SwitchCase": {
      traverse(node.test, action, scope);
      const consequents = node.consequent;
      for (let i = 0; i < consequents.length; i++) {
        traverse(consequents[i], action, scope);
      }
      break;
    }
    case "ConditionalExpression": {
      traverse(node.test, action, scope);
      traverse(node.consequent, action, scope);
      traverse(node.alternate, action, scope);
      break;
    }
    case "ObjectPattern": {
      const properties = node.properties;
      for (let i = 0; i < properties.length; i++) {
        traverse(properties[i], action, scope);
      }
      break;
    }
    case "ObjectProperty": {
      traverse(node.key, action, scope);
      traverse(node.value, action, scope);
      break;
    }
    case "ObjectExpression": {
      const properties = node.properties;
      for (let i = 0; i < properties.length; i++) {
        traverse(properties[i], action, scope);
      }
      break;
    }
    case "NewExpression": {
      traverse(node.callee, action, scope);
      const args = node.arguments;
      for (let i = 0; i < args.length; i++) {
        traverse(args[i], action, scope);
      }
      break;
    }
    case "ArrayExpression": {
      const elements = node.elements;
      for (let i = 0; i < elements.length; i++) {
        traverse(elements[i], action, scope);
      }
      break;
    }
    case "TemplateLiteral": {
      const quasis = node.quasis;
      for (let i = 0; i < quasis.length; i++) {
        traverse(quasis[i], action, scope);
      }
      const expressions = node.expressions;
      for (let i = 0; i < expressions.length; i++) {
        traverse(expressions[i], action, scope);
      }
      break;
    }
    case "LogicalExpression": {
      traverse(node.left, action, scope);
      traverse(node.right, action, scope);
      break;
    }
    case "UnaryExpression": {
      traverse(node.expression, action, scope);
      traverse(node.argument, action, scope);
      break;
    }
    case "TemplateElement": {
      // NO-OP?
      break;
    }
    case "AssignmentExpression": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        assignExpression(node.left, node.right, action, scope);
      } else if (action === Actions.ReplaceWithOptimized &&
        node.right.optimized === true) {
        return node.right.optimizedReplacement;
      }
      break;
    }
    case "TryStatement": {
      traverse(node.block, action, scope);
      traverse(node.handler, action, scope);
      break;
    }
    case "CatchClause": {
      traverse(node.param, action, scope);
      traverse(node.body, action, scope);
      break;
    }
    case "TypeCastExpression": {
      traverse(node.expression, action, scope);
      traverse(node.typeAnnotation, action, scope);
      break;
    }
    case "TypeAnnotation": {
      traverse(node.typeAnnotation, action, scope);
      break;
    }
    case "GenericTypeAnnotation": {
      traverse(node.id, action, scope);
      break;
    }
    case "ClassMethod": {
      traverse(node.body, action, scope);
      break;
    }
    case "JSXNamespacedName": {
      traverse(node.name, action, scope);
      traverse(node.namespace, action, scope);
      break;
    }
    case "SpreadElement": {
      traverse(node.argument, action, scope);
      break;
    }
    case "SpreadProperty": {
      traverse(node.argument, action, scope);
      break;
    }
    case "FunctionDeclaration": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        node.optimized = false;
        node.optimizedReplacement = null;
        declareFunction(
          node,
          node.id,
          node.params,
          node.body,
          action,
          scope,
          true
        );
        break;
      } else if (
        action === Actions.ReplaceWithOptimized &&
        node.optimized === true
      ) {
        return node.optimizedReplacement;
      }
    }
    case "ClassProperty": {
      traverse(node.key, action, scope);
      traverse(node.value, action, scope);
      break;
    }
    case "Program": {
      const body = node.body;
      node.scope = scope;
      for (let i = 0; i < body.length; i++) {
        const bodyNode = traverse(body[i], action, scope);
        if (bodyNode !== undefined) {
          body[i] = bodyNode;
        }
      }
      scope.deferredScopes.map(deferredScope => deferredScope.scopeFunc());
      break;
    }
    case "ClassDeclaration": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        declareClass(node, node.id, node.superClass, node.body, action, scope);
      } else if (
        action === Actions.ReplaceWithOptimized &&
        node.optimized === true
      ) {
        return node.optimizedReplacement;
      }
      break;
    }
    case "ClassExpression": {
      if (
        action === Actions.ScanInnerScope ||
        action === Actions.ScanTopLevelScope
      ) {
        declareClass(node, node.id, node.superClass, node.body, action, scope);
      } else if (
        action === Actions.ReplaceWithOptimized &&
        node.optimized === true
      ) {
        return node.optimizedReplacement;
      }
      break;
    }
    case "ThrowStatement": {
      traverse(node.argument, action, scope);
      break;
    }
    case "SequenceExpression": {
      const expressions = node.expressions;
      for (let i = 0; i < expressions.length; i++) {
        traverse(expressions[i], action, scope);
      }
      break;
    }
    case "Super":
    case "RestProperty":
    case "AnyTypeAnnotation":
    case "ThisExpression":
    case "JSXText":
    case "StringLiteral":
    case "NumericLiteral":
    case "JSXIdentifier":
    case "NullLiteral":
    case "BooleanLiteral":
    case "RegExpLiteral":
    case "ContinueStatement":
    case "Identifier": {
      // NO-OP
      break;
    }
    default:
      // TODO
      debugger;
  }
}

function getNameFromAst(astNode) {
  if (astNode === null || astNode === undefined) {
    return null;
  }
  if (typeof astNode === 'number') {
    return astNode;
  }
  const type = astNode.type;
  switch (type) {
    case "Identifier":
    case "JSXIdentifier": {
      return astNode.name;
    }
    case "ThisExpression": {
      return "this";
    }
    case "NewExpression":
    case "CallExpression": {
      return `new ${getNameFromAst(astNode.callee)}()`;
    }
    case "MemberExpression": {
      return `${getNameFromAst(astNode.object)}.${getNameFromAst(astNode.property)}`;
    }
    default:
      debugger;
  }
}

function handleMultipleValues(value) {
  if (Array.isArray(value)) {
    // return the last one in the array that is not innerScope
    let i = 1;
    let lastValue = value[value.length - i];
    while (lastValue.action === Actions.ScanInnerScope) {
      i++;
      lastValue = value[value.length - i];
    }
    return lastValue;
  } else {
    return value;
  }
}

function getOrSetValueFromAst(astNode, subject, action, newValue) {
  let type;
  
  if (typeof astNode === 'number') {
    type = 'Identifier';
  } else {
    type = astNode.type;
  }
  switch (type) {
    case "NumericLiteral":
    case "BooleanLiteral":
    case "StringLiteral": {
      return astNode.value;
    }
    case "ThisExpression":
    case "JSXIdentifier":
    case "Identifier": {
      const key = getNameFromAst(astNode);

      if (key === "undefined") {
        return createUndefined();
      } else if (subject.type === Types.Scope) {
        while (subject !== null) {
          if (subject.assignments.has(key)) {
            if (newValue !== undefined) {
              if (newValue !== undefined) {
                newValue.action = action;
              }
              assign(subject, "assignments", key, newValue);
              return newValue;
            } else {
              return handleMultipleValues(subject.assignments.get(key));
            }
          } else {
            subject = subject.parentScope;
          }
        }
        debugger;
      } else if (subject.type === Types.Object || subject.type === Types.Array) {
        if (newValue !== undefined) {
          if (newValue.action !== undefined) {
            newValue.action = action;
          }
          assign(subject, "properties", key, newValue);
          return newValue;
        } else {
          let accesorObject;
          if (subject.accessors.has(key)) {
            accesorObject = subject.accessors.get(key);
          } else {
            accesorObject = createObject();
            subject.accessors.set(key, accesorObject);
          }
          if (subject.properties.has(key)) {
            return handleMultipleValues(subject.properties.get(key));
          }
          return accesorObject;
        }
      } else if (subject.type === Types.FunctionCall) {
        if (
          subject.identifier.name === "require" &&
          subject.args.length === 1 &&
          (subject.args[0] === "PropTypes" || subject.args[0] === "prop-types")
        ) {
          return getOrSetValueFromAst(astNode, propTypes, action, newValue);
        }
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.AbstractObject) {
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.AbstractFunction) {
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.AbstractUnknown) {
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.MathExpression) {
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.ConditionalExpression) {
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.LogicExpression) {
        // who knows what it could be?
        return createAbstractUnknown(false);
      } else if (subject.type === Types.Identifier) {
        // NO OP
      } else if (subject.type === Types.Function) {
        return getOrSetValueFromAst(
          astNode,
          subject.properties,
          action,
          newValue
        );
      } else if (subject.type === Types.Class) {
        const parentScope = subject.scope;
        parentScope.deferredScopes.push({
          name: key,
          scopeFunc() {
            debugger;
            newValue.astNode.forEach(bodyPart => {
              declareClassMethod(bodyPart, subject.thisObject, parentScope, action);
            });
          },
        });
        return newValue;
      } else {
        debugger;
      }
      debugger;
      return null;
    }
    case "ArrayExpression": {
      const astElements = astNode.elements;
      const arr = createArray(astNode);
      astElements.forEach((astElement, i) => {
        getOrSetValueFromAst(i, arr, action, getOrSetValueFromAst(astElement, subject, action));
      });
      return arr;
    }
    case "ObjectExpression": {
      const astProperties = astNode.properties;
      const obj = createObject(astNode);
      astProperties.forEach(astProperty => {
        if (astProperty.type === "ObjectProperty") {
          getOrSetValueFromAst(
            astProperty.key,
            obj,
            action,
            getOrSetValueFromAst(astProperty.value, subject, action)
          );
        } else if (astProperty.type === "ObjectMethod") {
          getOrSetValueFromAst(
            astProperty.key,
            obj,
            action,
            declareFunction(
              astProperty,
              astProperty.id,
              astProperty.params,
              astProperty.body,
              action,
              subject,
              false
            )
          );
        } else {
          debugger;
        }
      });
      return obj;
    }
    case "ObjectProperty": {
      debugger;
      break;
    }
    case "MemberExpression": {
      const astObject = astNode.object;
      const astProperty = astNode.property;
      const object = getOrSetValueFromAst(astObject, subject, action);

      if (object !== null) {
        if (astProperty.type === "Identifier") {
          return getOrSetValueFromAst(astProperty, object, action, newValue);
        } else if (astProperty.type === "NumericLiteral") {
          return getOrSetValueFromAst(astProperty.value, object, action, newValue);
        } else {
          debugger;
        }
      } else {
        console.warn(
          `Could not find an identifier for "${getNameFromAst(astObject)}.${getNameFromAst(astProperty)}"`
        );
        return null;
      }
    }
    case "CallExpression": {
      return callFunction(
        astNode,
        astNode.callee,
        astNode.arguments,
        action,
        subject
      );
    }
    case "BinaryExpression": {
      const astLeft = astNode.left;
      const astRight = astNode.right;
      const operator = astNode.operator;
      return createMathExpression(
        getOrSetValueFromAst(astLeft, subject, action),
        getOrSetValueFromAst(astRight, subject, action),
        operator
      );
    }
    case "NewExpression": {
      return getOrSetValueFromAst(astNode.callee, subject, action);
    }
    case "FunctionExpression": {
      return declareFunction(
        astNode,
        astNode.id,
        astNode.params,
        astNode.body,
        action,
        subject,
        true
      );
    }
    case "NullLiteral": {
      return createNull();
    }
    case "ArrowFunctionExpression": {
      return declareFunction(
        astNode,
        astNode.id,
        astNode.params,
        astNode.body,
        action,
        subject,
        false
      );
    }
    case "LogicalExpression": {
      const astLeft = astNode.left;
      const astRight = astNode.right;
      const operator = astNode.operator;
      return createLogicExpression(
        getOrSetValueFromAst(astLeft, subject, action),
        getOrSetValueFromAst(astRight, subject, action),
        operator
      );
    }
    case "UnaryExpression": {
      const astArgument = astNode.argument;
      const operator = astNode.operator;
      return createUnaryExpression(
        getOrSetValueFromAst(astArgument, subject, action),
        operator
      );
    }
    case "ConditionalExpression": {
      const astAlternate = astNode.alternate;
      const astConsequent = astNode.consequent;
      const astTest = astNode.test;
      return createConditionalExpression(
        getOrSetValueFromAst(astAlternate, subject, action),
        getOrSetValueFromAst(astConsequent, subject, action),
        getOrSetValueFromAst(astTest, subject, action)
      );
    }
    default: {
      debugger;
    }
  }
}

function callFunction(astNode, callee, args, action, scope) {
  let functionRef = getOrSetValueFromAst(callee, scope, action);

  if (functionRef == null) {
    console.warn(
      `Could not find an identifier for function call "${getNameFromAst(callee)}"`
    );
    const abstractUnknown = createAbstractUnknown(false);
    scope.calls.push(abstractUnknown);
    return abstractUnknown;
  } else if (functionRef.type === Types.Undefined) {
    throw new Error(
      `Could not call an  identifier that is "undefined" for function call "${getNameFromAst(callee)}"`
    );
  } else if (functionRef.type === Types.Null) {
    throw new Error(
      `Could not call an  identifier that is "null" for function call "${getNameFromAst(callee)}"`
    );
  } else if (functionRef.type === Types.FunctionCall) {
    functionRef = createAbstractFunction(getNameFromAst(callee));
  }
  const functionCall = createFunctionCall(functionRef, astNode);
  functionCall.args = args.map(astArgument =>
    getOrSetValueFromAst(astArgument, scope, action)
  );
  if (
    functionRef.type === Types.AbstractFunction ||
    functionRef.type === Types.Function
  ) {
    functionRef.callSites.push(functionCall);
  }
  scope.calls.push(functionCall);
  return functionCall;
}

function getObjectProperty(object, property) {
  if (object.type === Types.FunctionCall) {
    return createAbstractUnknown(true);
  } else {
    debugger;
  }
}

function declareVariable(id, init, action, scope) {
  if (id.type === "ObjectPattern") {
    const astProperties = id.properties;
    const value = getOrSetValueFromAst(init, scope, action);

    astProperties.forEach(astProperty => {
      const astKey = astProperty.key;
      const astValue = astProperty.value;
      const nameAssignKey = getNameFromAst(astKey);
      const valueAssignKey = getNameFromAst(astValue);

      assign(
        scope,
        "assignments",
        valueAssignKey,
        getObjectProperty(value, nameAssignKey)
      );
    });
  } else {
    const assignKey = getNameFromAst(id);
    const value = init === null
      ? createUndefined()
      : getOrSetValueFromAst(init, scope, action);

    assign(scope, "assignments", assignKey, value);
  }
}

function declareClassMethod(bodyPart, thisAssignment, scope, action) {
  if (bodyPart.type === "ClassMethod") {
    const newScope = createScope(thisAssignment);
    newScope.parentScope = scope;
    bodyPart.scope = newScope;
    traverse(bodyPart, action, newScope);
  } else {
    debugger;
  }
}

function declareClass(node, id, superId, body, action, scope) {
  const classAssignKey = getNameFromAst(id);
  const superAssignKey = superId !== null
    ? getOrSetValueFromAst(superId, scope, action)
    : null;
  const theClass = createClass(classAssignKey, node, superAssignKey, scope);
  const astClassBody = body.body;
  const thisAssignment = {
    this: theClass.thisObject
  };
  node.optimized = false;
  node.optimizedReplacement = null;
  node.class = theClass;
  scope.deferredScopes.push({
    name: getNameFromAst(node.id),
    scopeFunc() {
      astClassBody.forEach(bodyPart => {
        declareClassMethod(bodyPart, thisAssignment, scope, action);
      });
    },
  });
  assign(scope, "assignments", classAssignKey, theClass);
}

function declareFunction(node, id, params, body, action, scope, assignToScope) {
  const assignKey = getNameFromAst(id);
  const newScope = createScope();
  const func = createFunction(assignKey, node, scope);

  for (let i = 0; i < params.length; i++) {
    const param = params[i];

    if (param.type === "ObjectPattern") {
      const paramObject = createObject(null);
      param.properties.forEach(property => {
        if (property.type === "ObjectProperty") {
          if (property.value.type === 'ObjectProperty') {
            throw new Error('Cannot yet handle deeply nested object destructuring');
          }
          const propertyAssignKey = getNameFromAst(property.value);
          const identifier = createObject();
          assign(newScope, "assignments", propertyAssignKey, identifier);
          assign(paramObject, "accessors", propertyAssignKey, identifier);
        } else {
          debugger;
        }
      });
      func.params.push(paramObject);
    } else if (param.type === "Identifier") {
      const propertyAssignKey = param.name;
      const paramObject = createObject();
      assign(newScope, "assignments", propertyAssignKey, paramObject);
      func.params.push(paramObject);
    } else {
      debugger;
    }
  }
  const argumentsObj = createObject();
  assign(newScope, "assignments", 'arguments', argumentsObj);
  node.scope = newScope;
  node.func = func;
  newScope.parentScope = scope;
  if (assignToScope === true) {
    assign(scope, "assignments", assignKey, func);
  }
  scope.deferredScopes.push({
    name: getNameFromAst(node.id),
    scopeFunc() {
      return traverse(body, Actions.ScanInnerScope, newScope);
    }
  });
  newScope.deferredScopes.map(deferredScope => deferredScope.scopeFunc());
  return func;
}

function assignExpression(left, right, action, scope) {
  getOrSetValueFromAst(
    left,
    scope,
    action,
    getOrSetValueFromAst(right, scope, action)
  );
}

module.exports = {
  Actions: Actions,
  createModuleScope: createModuleScope,
  traverse: traverse,
  handleMultipleValues: handleMultipleValues
};
