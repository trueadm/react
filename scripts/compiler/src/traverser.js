"use strict";

const Actions = {
  Scan: 'Scan',
  AssignConst: 'AssignConst',
};

const Types = {
  Class: 'Class',
  Function: 'Function',
  FunctionCall: 'FunctionCall',
  Object: 'Object',
  Scope: 'Scope',
  Identifier: 'Identifier',
  MathExpression: 'MathExpression',
  Undefined: 'Undefined',
  Null: 'Null',
  AbstractObject: 'AbstractObject',
  AbstractFunction: 'AbstractFunction',
  AbstractUnknown: 'AbstractUnknown',
};

function createMathExpression(left, right, operator) {
  return {
    left: left,
    operator: operator,
    right: right,
    type: Types.MathExpression,
  }
}

function createUndefined() {
  return {
    type: Types.Undefined,
  };
}

function createNull() {
  return {
    type: Types.Null,
  };
}

function createIdentifier() {
  return {
    type: Types.Identifier,
  }
}

function createAbstractObject() {
  return {
    type: Types.AbstractObject,
  }
}

function createAbstractUnknown() {
  return {
    type: Types.AbstractUnknown,
  }
}

function createAbstractFunction() {
  return {
    callSites: [],
    type: Types.AbstractFunction,
  }
}

function createFunction(name, astNode) {
  return {
    astNode: astNode,
    callSites: [],
    name: name,
    params: [],
    type: Types.Function,
  }
}

function createClass(name, astNode, superIdentifier) {
  return {
    type: Types.Class,
    astNode: astNode,
    name: name,
    superIdentifier: superIdentifier,
  }
}

function createFunctionCall(identifier, astNode) {
  return {
    astNode: astNode,
    type: Types.FunctionCall,
    identifier: identifier,
    args: [],
  };
}

function createScope(assignments) {
  const scope = {
    type: Types.Scope,
    assignments: new Map(),
    parentScope: null,
  };
  if (assignments != null) {
    Object.keys(assignments).forEach(
      assignment => assign(scope, 'assignments', assignment, assignments[assignment])
    );
  }
  return scope;
}

function createObject(properties) {
  const object = {
    type: Types.Object,
    properties: new Map(),
  };
  if (properties != null) {
    Object.keys(properties).forEach(
      property => assign(object, 'properties', property, properties[property])
    );
  }
  return object;
}

function createModuleScope() {
  return createScope({
    module: createObject({
      exports: createObject()
    }),
    require: createAbstractFunction(),
    window: createAbstractObject(),
    document: createAbstractObject(),
    Date: createAbstractFunction(),
  });
}

function assign(subject, topic, name, value) {
  if (subject[topic].has(name)) {
    const previousValue = subject[topic].get(name);

    if (Array.isArray(previousValue)) {
      previousValue.push(value)
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
      traverse(node.callee, action, scope);
      const args = node.arguments;
      for (let i = 0; i < args.length; i++) {
        traverse(args[i], action, scope);
      }
      break;
    }
    case "VariableDeclaration": {
      const declarations = node.declarations;
      action = Actions.AssignConst;
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
      declareFunction(node, node.id, node.params, node.body, action, scope);
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
      break;
    }
    case "ClassDeclaration": {
      declareClass(node, node.id, node.superClass, node.body, scope);
      break;
    }
    case "ClassExpression": {
      declareClass(node, node.id, node.superClass, node.body, scope);
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
    case 'Identifier': {
      return astNode.name;
    }
    case 'ThisExpression': {
      return 'this';
    }
    case 'NewExpression': {
      return `new ${getNameFromAst(astNode.callee)}()`;
    }
    case 'MemberExpression': {
      return `${getNameFromAst(astNode.object)}.${getNameFromAst(astNode.property)}`;
    }
    default:
      debugger; 
  }
}

function handleMultipleValues(value) {
  if (Array.isArray(value)) {
    // return the last one in the array
    const lastValue = value[value.length - 1];
    return lastValue;
  } else {
    return value;
  }
}

function getOrSetValueFromAst(astNode, subject, newValue) {
  const type = astNode.type;
  switch (type) {
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'StringLiteral': {
      return astNode.value;
    }
    case 'ThisExpression':
    case 'Identifier': {
      const key = getNameFromAst(astNode);

      if (key === 'undefined') {
        return createUndefined();
      } else if (subject.type === Types.Scope) {
        while (subject !== null) {
          if (subject.assignments.has(key)) {
            if (newValue !== undefined) {
              assign(subject, 'assignments', key, newValue);
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
          assign(subject, 'properties', key, newValue);
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
      } else {
        debugger;
      }
      return null;
    }
    case 'ObjectExpression': {
      const astProperties = astNode.properties;
      const obj = createObject();
      astProperties.forEach(astProperty => {
        getOrSetValueFromAst(astProperty.key, obj, getOrSetValueFromAst(astProperty.value, subject));
      });
      return obj;
    }
    case 'ObjectProperty': {
      debugger;
    }
    case 'MemberExpression': {
      const astObject = astNode.object;
      const astProperty = astNode.property;
      const object = getOrSetValueFromAst(astObject, subject);

      if (object !== null) {
        if (astProperty.type === 'Identifier') {
          return getOrSetValueFromAst(astProperty, object, newValue);
        } else {
          debugger;
        }
      } else {
        console.warn(`Could not find an identifier for "${getNameFromAst(astObject)}.${getNameFromAst(astProperty)}"`);
        return null;
      }
    }
    case 'CallExpression': {
      const astCallee = astNode.callee;
      const astArguments = astNode.arguments;
      let functionRef = getOrSetValueFromAst(astCallee, subject);

      if (functionRef == null) {
        console.warn(`Could not find an identifier for function call "${getNameFromAst(astCallee)}"`);
      } else if (functionRef.type === Types.Undefined) {
        throw new Error(`Could not call an  identifier that is "undefined" for function call "${getNameFromAst(astCallee)}"`);
      } else if (functionRef.type === Types.Null) {
        throw new Error(`Could not call an  identifier that is "null" for function call "${getNameFromAst(astCallee)}"`);
      } else if (functionRef.type === Types.FunctionCall) {
        functionRef = createAbstractFunction();
      }
      const functionCall = createFunctionCall(functionRef, astNode);
      functionCall.args = astArguments.map(astArgument => getOrSetValueFromAst(astArgument, subject));
      if (functionRef.type === Types.AbstractFunction || functionRef.type === Types.Function) {
        functionRef.callSites.push(functionCall);
      }
      return functionCall;
    }
    case 'BinaryExpression': {
      const astLeft = astNode.left;
      const astRight = astNode.right;
      const operator = astNode.operator;
      return createMathExpression(
        getOrSetValueFromAst(astLeft, subject),
        getOrSetValueFromAst(astRight, subject),
        operator
      );
    }
    case 'NewExpression': {
      return getOrSetValueFromAst(astNode.callee, subject);
    }
    case 'FunctionExpression': {
      return declareFunction(astNode, astNode.id, astNode.params, astNode.body, Actions.Scan, subject);
    }
    case 'NullLiteral': {
      return createNull();
    }
    default: {
      debugger;
    }
  }
}

function declareVariable(id, init, action, scope) {
  const assignKey = getNameFromAst(id);
  const value = init === null ? createUndefined() : getOrSetValueFromAst(init, scope);

  assign(scope, 'assignments', assignKey, value);
}

function declareClass(node, id, superId, body, scope) {
  const classAssignKey = getNameFromAst(id);
  const superAssignKey = superId !== null ? getOrSetValueFromAst(superId, scope) : null;
  const theClass = createClass(classAssignKey, node, superAssignKey);
  const astClassBody = body.body;
  const thisAssignment = {
    this: createObject()
  };
  // TODO, work out the "this" variables etc
  astClassBody.forEach(bodyPart => {
    if (bodyPart.type === 'ClassMethod') {
      const newScope = createScope(thisAssignment);
      newScope.parentScope = scope;
      traverse(bodyPart, Actions.Scan, newScope);
    } else {
      debugger;
    }
  });
  assign(scope, 'assignments', classAssignKey, theClass);
}

function declareFunction(node, id, params, body, action, scope) {
  const assignKey = getNameFromAst(id);
  const func = createFunction(assignKey, node);
  const newScope = createScope();
  
  for (let i = 0; i < params.length; i++) {
    const param = params[i];

    if (param.type === 'ObjectPattern') {
      const paramObject = createObject();
      param.properties.forEach(property => {
        if (property.type === 'ObjectProperty') {
          const propertyAssignKey = getNameFromAst(property.value);
          const identifier = createIdentifier();
          assign(newScope, 'assignments', propertyAssignKey, identifier);
          assign(paramObject, 'properties', propertyAssignKey, identifier);
        } else {
          debugger;
        }
      });
      func.params.push(paramObject);
    } else if (param.type === 'Identifier') {
      const propertyAssignKey = param.name;
      const identifier = createIdentifier();
      assign(newScope, 'assignments', propertyAssignKey, identifier);
      func.params.push(identifier);
    } else {
      debugger;
    }
  }
  node.scope = newScope;
  newScope.parentScope = scope;
  assign(scope, 'assignments', assignKey, func);
  traverse(body, Actions.Scan, newScope);
}

function assignExpression(left, right, action, scope) {
  getOrSetValueFromAst(left, scope, getOrSetValueFromAst(right, scope));
}

module.exports = {
  Actions, Actions,
  createModuleScope: createModuleScope,
  traverse: traverse
};
