"use strict";

const Actions = {
  ScanTopLevelScope: "ScanTopLevelScope",
  ScanInnerScope: "ScanInnerScope",
};

const Types = {
  Class: "Class",
  Function: "Function",
  FunctionCall: "FunctionCall",
  Object: "Object",
  Scope: "Scope",
  Identifier: "Identifier",
  MathExpression: "MathExpression",
  Undefined: "Undefined",
  Null: "Null",
  AbstractObject: "AbstractObject",
  AbstractFunction: "AbstractFunction",
  AbstractUnknown: "AbstractUnknown"
};

function createMathExpression(left, right, operator) {
  return {
    action: null,
    left: left,
    operator: operator,
    right: right,
    type: Types.MathExpression
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

function createAbstractUnknown() {
  return {
    action: null,
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
    scope: scope,
    type: Types.Function
  };
}

function createClass(name, astNode, superIdentifier) {
  return {
    action: null,
    type: Types.Class,
    astNode: astNode,
    name: name,
    superIdentifier: superIdentifier
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

function createModuleScope() {
  return createScope({
    module: createObject(null, {
      exports: createObject(null)
    }),
    require: createAbstractFunction("require"),
    window: createAbstractObject(),
    document: createAbstractObject()
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
      traverse(node.openingElement, action, scope);
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        traverse(children[i], action, scope);
      }
      break;
    }
    case "JSXOpeningElement": {
      traverse(node.name, action, scope);
      const attributes = node.attributes;
      for (let i = 0; i < attributes.length; i++) {
        traverse(attributes[i], action, scope);
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
      traverse(node.expression, action, scope);
      break;
    }
    case "MemberExpression": {
      traverse(node.object, action, scope);
      break;
    }
    case "CallExpression": {
      callFunction(node, node.callee, node.arguments, action, scope);
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
      declareVariable(node.id, node.init, action, scope);
      break;
    }
    case "ForStatement": {
      traverse(node.body, action, scope);
      traverse(node.init, action, scope);
      traverse(node.test, action, scope);
      traverse(node.update, action, scope);
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
      break;
    }
    case "FunctionExpression": {
      traverse(node.body, action, scope);
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
      traverse(mode, node.test, state);
      const consequents = node.consequent;
      for (let i = 0; i < consequents.length; i++) {
        traverse(consequents[i], action, scope);
      }
      break;
    }
    case "ConditionalExpression": {
      traverse(node.alternate, action, scope);
      traverse(node.consequent, action, scope);
      traverse(node.test, action, scope);
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
      assignExpression(node.left, node.right, action, scope);
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
        traverse(body[i], action, scope);
      }
      scope.deferredScopes.map(deferredScope => deferredScope.scopeFunc());
      break;
    }
    case "ClassDeclaration": {
      declareClass(node, node.id, node.superClass, node.body, action, scope);
      break;
    }
    case "ClassExpression": {
      declareClass(node, node.id, node.superClass, node.body, action, scope);
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
  const type = astNode.type;
  switch (type) {
    case "Identifier": {
      return astNode.name;
    }
    case "ThisExpression": {
      return "this";
    }
    case "NewExpression": {
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
  const type = astNode.type;
  switch (type) {
    case "NumericLiteral":
    case "BooleanLiteral":
    case "StringLiteral": {
      return astNode.value;
    }
    case "ThisExpression":
    case "Identifier": {
      const key = getNameFromAst(astNode);

      if (key === "undefined") {
        return createUndefined();
      } else if (subject.type === Types.Scope) {
        while (subject !== null) {
          if (subject.assignments.has(key)) {
            if (newValue !== undefined) {
              newValue.action = action;
              assign(subject, "assignments", key, newValue);
              break;
            } else {
              return handleMultipleValues(subject.assignments.get(key));
            }
          } else {
            subject = subject.parentScope;
          }
        }
      } else if (subject.type === Types.Object) {
        if (newValue !== undefined) {
          newValue.action = action;
          assign(subject, "properties", key, newValue);
        } else {
          if (subject.properties.has(key)) {
            return handleMultipleValues(subject.properties.get(key));
          }
        }
      } else if (subject.type === Types.FunctionCall) {
        // who knows what it could be?
        return createAbstractUnknown();
      } else if (subject.type === Types.AbstractFunction) {
        // who knows what it could be?
        return createAbstractUnknown();
      } else if (subject.type === Types.AbstractUnknown) {
        // who knows what it could be?
        return createAbstractUnknown();
      } else if (subject.type === Types.Identifier) {
        // NO OP
      } else {
        debugger;
      }
      return null;
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
    const abstractUnknown = createAbstractUnknown();
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
    return createAbstractUnknown();
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

function declareClass(node, id, superId, body, action, scope) {
  const classAssignKey = getNameFromAst(id);
  const superAssignKey = superId !== null
    ? getOrSetValueFromAst(superId, scope, action)
    : null;
  const theClass = createClass(classAssignKey, node, superAssignKey);
  const astClassBody = body.body;
  const thisAssignment = {
    this: createObject(null)
  };
  // TODO, work out the "this" variables etc
  astClassBody.forEach(bodyPart => {
    if (bodyPart.type === "ClassMethod") {
      const newScope = createScope(thisAssignment);
      newScope.parentScope = scope;
      traverse(bodyPart, action, newScope);
    } else {
      debugger;
    }
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
          const propertyAssignKey = getNameFromAst(property.value);
          const identifier = createIdentifier();
          assign(newScope, "assignments", propertyAssignKey, identifier);
          assign(paramObject, "properties", propertyAssignKey, identifier);
        } else {
          debugger;
        }
      });
      func.params.push(paramObject);
    } else if (param.type === "Identifier") {
      const propertyAssignKey = param.name;
      const identifier = createIdentifier();
      assign(newScope, "assignments", propertyAssignKey, identifier);
      func.params.push(identifier);
    } else {
      debugger;
    }
  }
  node.scope = newScope;
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
  traverse: traverse
};
