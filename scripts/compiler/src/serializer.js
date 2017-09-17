/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

const {
  AbstractValue,
  ArrayValue,
  FunctionValue,
  ObjectValue,
  NullValue,
  NumberValue,
  SymbolValue,
  UndefinedValue,
} = require('prepack/lib/values');
const t = require('babel-types');
const evaluator = require('./evaluator');

function getFunctionReferenceName(functionValue) {
  let name = null;
  if (functionValue.__originalName) {
    name = functionValue.__originalName;
  }
  const namer = functionValue.properties.get('name');
  if (namer && namer.descriptor.value.value) {
    name = namer.descriptor.value.value;
  }

  if (name !== null) {
    const hasThis =
      functionValue.$HomeObject !== undefined &&
      functionValue.$HomeObject.properties.has(name);
    return `${hasThis ? 'this.' : ''}${name}`;
  }
  // debugger;
  return null;
}

function convertExpressionToJSXIdentifier(expr, rootConfig) {
  switch (expr.type) {
    case 'ThisExpression':
      return t.jSXIdentifier('this');
    case 'Identifier':
      return t.jSXIdentifier(expr.name);
    case 'StringLiteral':
      return t.jSXIdentifier(expr.value);
    case 'MemberExpression':
      if (expr.computed) {
        throw new Error('Cannot inline computed expressions in JSX type.');
      }
      return t.jSXMemberExpression(
        convertExpressionToJSXIdentifier(expr.object),
        convertExpressionToJSXIdentifier(expr.property)
      );
    case 'ArrowFunctionExpression':
      return expr;
    default:
      debugger;
      throw new Error('Invalid JSX Type: ' + expr.type);
  }
}

function convertKeyValueToJSXAttribute(key, value, rootConfig) {
  let expr = convertValueToExpression(value, rootConfig);
  return t.jSXAttribute(
    t.jSXIdentifier(key),
    expr.type === 'StringLiteral' ? expr : t.jSXExpressionContainer(expr)
  );
}

function addKeyToElement(astElement, key) {
  const astAttributes = astElement.openingElement.attributes;
  let existingKey = null;

  for (let i = 0; i < astAttributes.length; i++) {
    const astAttribute = astAttributes[i];

    if (
      astAttribute.type === 'JSXAttribute' &&
      astAttribute.name.type === 'JSXIdentifier' &&
      astAttribute.name.name === 'key'
    ) {
      existingKey = astAttribute.value;
    }
  }
  if (existingKey !== null) {
    // do nothing for now
  } else {
    astAttributes.push(
      t.jSXAttribute(t.jSXIdentifier('key'), t.stringLiteral(key))
    );
  }
}

// as we compile and inline components, nested arrays will be common
// to avoid key issues and bad updates, we need to manually add keys
// to static children that won't ever collide
function applyKeysToNestedArray(expr) {
  const astElements = expr.elements;
  const randomHashString = Math.random().toString(36).substring(5);

  for (let i = 0; i < astElements.length; i++) {
    const astElement = astElements[i];

    if (astElement.type === 'JSXElement') {
      addKeyToElement(astElement, `.${randomHashString}.${i}`);
    }
  }
}

function convertReactElementToJSXExpression(objectValue, rootConfig) {
  const objectProps = objectValue.properties;
  let typeValue = objectProps.get('type').descriptor.value;
  let keyValue = objectProps.has('key')
    ? objectProps.get('key').descriptor.value
    : null;
  let refValue = objectProps.has('ref')
    ? objectProps.get('ref').descriptor.value
    : null;
  let propsValue = objectProps.get('props').descriptor.value;

  let identifier = convertExpressionToJSXIdentifier(
    convertValueToExpression(typeValue, rootConfig),
    rootConfig
  );
  let attributes = [];
  let children = [];

  if (
    keyValue !== null &&
    !(keyValue instanceof UndefinedValue || keyValue instanceof NullValue)
  ) {
    attributes.push(convertKeyValueToJSXAttribute('key', keyValue, rootConfig));
  }

  if (
    refValue !== null &&
    !(refValue instanceof UndefinedValue || refValue instanceof NullValue)
  ) {
    attributes.push(convertKeyValueToJSXAttribute('ref', refValue, rootConfig));
  }
  if (propsValue.properties) {
    for (let [key, propertyBinding] of propsValue.properties) {
      let desc = propertyBinding.descriptor;
      if (desc === undefined) continue; // deleted

      if (key === 'key' || key === 'ref') {
        throw new Error(key + ' is a reserved prop name');
      }

      if (key === 'children') {
        let expr = convertValueToExpression(desc.value, rootConfig);
        let elements = expr.type === 'ArrayExpression' &&
          expr.elements.length > 1
          ? expr.elements
          : [expr];
        children = elements.map(expr => {
          if (expr.type === 'ArrayExpression') {
            applyKeysToNestedArray(expr);
          }
          return expr === null
            ? t.jSXExpressionContainer(t.jSXEmptyExpression())
            : expr.type === 'StringLiteral'
                ? t.jSXText(expr.value)
                : expr.type === 'JSXElement'
                    ? expr
                    : t.jSXExpressionContainer(expr);
        });
        continue;
      }
      attributes.push(
        convertKeyValueToJSXAttribute(key, desc.value, rootConfig)
      );
    }
  } else {
    // spread
    attributes.push(
      t.jSXSpreadAttribute(convertValueToExpression(propsValue, rootConfig))
    );
  }

  if (identifier.type === 'ArrowFunctionExpression') {
    if (identifier.body.func !== undefined) {
      identifier = t.JSXIdentifier(identifier.body.func.name);
    } else if (identifier.params.func !== undefined) {
      // if its not there, I also hacked it onto the arguments
      identifier = t.JSXIdentifier(identifier.params.func.name);
    } else {
      // we need to do more hacking?
      debugger;
    }
  }

  let openingElement = t.jSXOpeningElement(
    identifier,
    attributes,
    children.length === 0
  );
  let closingElement = t.jSXClosingElement(identifier);

  return t.jSXElement(
    openingElement,
    closingElement,
    children,
    children.length === 0
  );
}

function convertObjectValueToObjectLiteral(objectValue, rootConfig) {
  let properties = [];
  for (let [key, propertyBinding] of objectValue.properties) {
    let desc = propertyBinding.descriptor;
    if (desc === undefined) continue; // deleted
    let expr = convertValueToExpression(desc.value, rootConfig);
    let property = t.objectProperty(t.stringLiteral(key), expr, false);
    properties.push(property);
  }
  return t.objectExpression(properties);
}

function convertArrayValueToArrayLiteral(arrayValue, rootConfig) {
  let lengthProperty = arrayValue.properties.get('length');
  if (
    !lengthProperty ||
    !(lengthProperty.descriptor.value instanceof NumberValue)
  ) {
    throw new Error('Invalid length');
  }
  let length = lengthProperty.descriptor.value.value;
  let elements = [];
  for (let i = 0; i < length; i++) {
    let elementProperty = arrayValue.properties.get('' + i);
    let elementValue =
      elementProperty &&
      elementProperty.descriptor &&
      elementProperty.descriptor.value;
    elements.push(
      elementValue ? convertValueToExpression(elementValue, rootConfig) : null
    );
  }
  return t.arrayExpression(elements);
}

function toIdentififer(string) {
  if (string === 'this') {
    return t.thisExpression();
  }
  return t.identifier(string);
}

function convertPrefixPlaceholderToExpression(placeholder) {
  const parts = placeholder.substr(3).split('$_$');
  let astNode = null;
  while (parts.length > 0) {
    if (parts.length === 1) {
      if (astNode === null) {
        astNode = toIdentififer(parts.shift());
      } else {
        astNode = t.memberExpression(astNode, toIdentififer(parts.shift()));
      }
    } else {
      if (astNode === null) {
        astNode = t.memberExpression(
          toIdentififer(parts.shift()),
          toIdentififer(parts.shift())
        );
      } else {
        debugger;
      }
    }
  }
  return astNode;
}

const alreadyGatheredArgs = new WeakMap();

function convertValueToExpression(value, rootConfig) {
  if (value instanceof AbstractValue) {
    let serializedArgs;
    if (alreadyGatheredArgs.has(value) === false) {
      serializedArgs = [];
      alreadyGatheredArgs.set(value, serializedArgs);
      for (let i = 0; i < value.args.length; i++) {
        const abstractArg = value.args[i];
        serializedArgs.push(convertValueToExpression(abstractArg, rootConfig));
      }
    } else {
      serializedArgs = alreadyGatheredArgs.get(value);
    }
    if (value.isIntrinsic()) {
      const intrinsicName = value.intrinsicName;
      if (intrinsicName.indexOf('_$') === 0) {
        const preludeGenerator = evaluator.getPreludeGenerator();
        if (preludeGenerator.derivedIds.has(intrinsicName)) {
          const derivedArgValues = preludeGenerator.derivedIds.get(
            intrinsicName
          );
          const derivedArgs = derivedArgValues.map(derivedArgValue =>
            convertValueToExpression(derivedArgValue, rootConfig)
          );
          if (typeof value._buildNode === 'function') {
            return value.buildNode(derivedArgs);
          } else {
            debugger;
          }
        } else {
          debugger;
        }
      }
      if (intrinsicName.indexOf('$F$') === 0) {
        return convertPrefixPlaceholderToExpression(intrinsicName);
      }
      if (
        rootConfig.useClassComponent === false &&
        value.intrinsicName.indexOf('this.props') !== -1
      ) {
        // hack for now
        const node = value.buildNode(serializedArgs);
        node.object = t.identifier('props');
        return node;
      }
    }
    return value.buildNode(serializedArgs);
  }
  if (value.isIntrinsic()) {
    return t.identifier(value.intrinsicName);
  }
  if (value instanceof FunctionValue) {
    // TODO: Get a proper reference from a lexical map of names instead.
    let name = getFunctionReferenceName(value);
    if (name !== null) {
      if (name.indexOf('bound') !== -1) {
        // this is a temp hack
        name = name.replace('bound ', '');
      }
      return t.identifier(name);
    } else {
      // TODO: assume an arrow function for now?
      return t.arrowFunctionExpression(
        value.$FormalParameters,
        value.$ECMAScriptCode
      );
    }
  }
  if (value instanceof ObjectValue) {
    if (value.properties.has('$$typeof')) {
      // TODO: Also compare the value to ensure it's the symbol
      return convertReactElementToJSXExpression(value, rootConfig);
    }
    if (value instanceof ArrayValue) {
      return convertArrayValueToArrayLiteral(value, rootConfig);
    }
    // TODO: Handle all the object special cases.
    return convertObjectValueToObjectLiteral(value, rootConfig);
  }
  if (value instanceof SymbolValue) {
    return t.nullLiteral();
  }
  return t.valueToNode(value.serialize());
}

function createClassConstructorBody(rootConfig) {
  const bodyBlock = [
    t.expressionStatement(
      t.callExpression(t.identifier('super'), [t.identifier('props')])
    ),
  ];
  const constructorProperties = rootConfig.getConstructorProperties(bodyBlock);
  if (constructorProperties !== null) {
    bodyBlock.push(...constructorProperties);
  }
  const mergedState = rootConfig.getMergedState();
  if (mergedState !== null) {
    bodyBlock.push(
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(t.thisExpression(), t.identifier('state')),
          mergedState
        )
      )
    );
  }
  return t.blockStatement(bodyBlock);
}

function serializeEvaluatedFunction(
  functionValue,
  args,
  evaluatedReturnValue,
  rootConfig
) {
  const name = getFunctionReferenceName(functionValue);
  const params = args.map(arg => {
    const intrinsicName = arg.intrinsicName;
    if (!intrinsicName) {
      throw new Error('Expected arguments to have an intrinsic name');
    }
    return t.identifier(intrinsicName);
  });
  const bodyExpr = convertValueToExpression(evaluatedReturnValue, rootConfig);
  const returnStatement = t.returnStatement(bodyExpr);
  const renderBody = t.blockStatement([returnStatement]);
  if (rootConfig.useClassComponent === true) {
    const constructorBody = createClassConstructorBody(rootConfig);
    const classBody = [
      // build the constructor method and put the merged state object back in
      // TODO: add in merged instance variables and other stuff
      t.classMethod(
        'constructor',
        t.identifier('constructor'),
        [t.identifier('props')],
        constructorBody
      ),
    ];
    const prototypeProperties = rootConfig.getPrototypeProperties();
    if (prototypeProperties !== null) {
      prototypeProperties.map(prototypeProperty => {
        classBody.push(prototypeProperty);
      });
    }
    classBody.push(
      // put in the optimized render method
      t.classMethod('method', t.identifier('render'), [], renderBody)
    );
    return t.classDeclaration(
      t.identifier(name),
      t.memberExpression(t.identifier('React'), t.identifier('Component')),
      t.classBody(classBody),
      []
    );
    // TODO: do a full run through of the "processed AST" at this point and DCE properties/methods?
  }
  return t.functionDeclaration(t.identifier(name), params, renderBody);
}

exports.convertValueToExpression = convertValueToExpression;

exports.serializeEvaluatedFunction = serializeEvaluatedFunction;

exports.convertPrefixPlaceholderToExpression = convertPrefixPlaceholderToExpression;
