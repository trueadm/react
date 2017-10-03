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
  ConcreteValue,
  NumberValue,
  StringValue,
} = require('prepack/lib/values');
const {
  ArrayCreate,
  CreateDataPropertyOrThrow,
  GetValue,
  ObjectCreate,
  ResolveBinding,
  Set,
  ToString,
} = require('prepack/lib/methods');
const t = require('babel-types');

let reactElementSymbol = undefined;
const reactElementSymbolKey = 'react.element';

const RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true,
};

function getReactElementSymbol(realm) {
  if (reactElementSymbol !== undefined) {
    return reactElementSymbol;
  }
  let SymbolFor = realm.intrinsics.Symbol.properties.get('for').descriptor
    .value;
  reactElementSymbol = SymbolFor.$Call(realm.intrinsics.Symbol, [
    new StringValue(realm, reactElementSymbolKey),
  ]);
  return reactElementSymbol;
}

// takan from Babel so we get it right
function cleanJSXElementLiteralChild(
  child,
  args
) {
  const lines = child.value.split(/\r\n|\n|\r/);

  let lastNonEmptyLine = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLine = i;
    }
  }

  let str = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;

    // replace rendered whitespace tabs with spaces
    let trimmedLine = line.replace(/\t/g, " ");

    // trim whitespace touching a newline
    if (!isFirstLine) {
      trimmedLine = trimmedLine.replace(/^[ ]+/, "");
    }

    // trim whitespace touching an endline
    if (!isLastLine) {
      trimmedLine = trimmedLine.replace(/[ ]+$/, "");
    }

    if (trimmedLine) {
      if (!isLastNonEmptyLine) {
        trimmedLine += " ";
      }

      str += trimmedLine;
    }
  }

  if (str) args.push(t.stringLiteral(str));
}

function createReactElement(realm, type, key, ref, props) {
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  CreateDataPropertyOrThrow(
    realm,
    obj,
    '$$typeof',
    getReactElementSymbol(realm)
  );
  CreateDataPropertyOrThrow(realm, obj, 'type', type);
  CreateDataPropertyOrThrow(realm, obj, 'key', key);
  CreateDataPropertyOrThrow(realm, obj, 'ref', ref);
  CreateDataPropertyOrThrow(realm, obj, 'props', props);
  CreateDataPropertyOrThrow(realm, obj, '_owner', realm.intrinsics.null);
  return obj;
}

function createReactElementWithSpread(realm, type, spread) {
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  CreateDataPropertyOrThrow(
    realm,
    obj,
    '$$typeof',
    getReactElementSymbol(realm)
  );
  CreateDataPropertyOrThrow(realm, obj, 'type', type);
  CreateDataPropertyOrThrow(realm, obj, 'props', spread);
  CreateDataPropertyOrThrow(realm, obj, '_owner', realm.intrinsics.null);
  return obj;
}

function createReactProps(realm, type, attributes, children, env) {
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  for (let [key, value] of attributes) {
    if (RESERVED_PROPS.hasOwnProperty(key)) {
      continue;
    }
    CreateDataPropertyOrThrow(realm, obj, key, value);
  }
  if (children !== null) {
    CreateDataPropertyOrThrow(realm, obj, 'children', children);
  }
  return obj;
}

function evaluateJSXMemberExpression(ast, strictCode, env, realm) {
  switch (ast.type) {
    case 'JSXIdentifier':
      return GetValue(realm, ResolveBinding(realm, ast.name, strictCode, env));
    case 'JSXMemberExpression':
      return evaluateJSXMemberExpression(ast, strictCode, env, realm);
    default:
      throw new Error('Unknown JSX Identifier');
  }
}

function evaluateJSXIdentifier(ast, strictCode, env, realm) {
  let isTagName = ast.type === 'JSXIdentifier' && /^[a-z]|\-/.test(ast.name);
  if (isTagName) {
    // Special cased lower-case and custom elements
    return new StringValue(realm, ast.name);
  }
  return evaluateJSXMemberExpression(ast, strictCode, env, realm);
}

function evaluateJSXValue(value, strictCode, env, realm) {
  switch (value.type) {
    case 'JSXText':
      return new StringValue(realm, value.value);
    case 'StringLiteral':
      return new StringValue(realm, value.value);
    case 'JSXExpressionContainer':
      return GetValue(realm, env.evaluate(value.expression, strictCode));
    case 'JSXElement':
      return GetValue(realm, env.evaluate(value, strictCode));
    default:
    debugger;
      throw new Error('Unkonw JSX value type: ' + value.type);
  }
}

function isReactComponent(elementType) {
  if (elementType.type === 'JSXIdentifier' && elementType.name[0] === elementType.name[0].toUpperCase()) {
    return true;
  }
}

function getDefaultProps(elementType, realm) {
  let name;
  if (elementType.type === 'JSXIdentifier') {
    name = elementType.name;
  }
  if (isReactComponent(elementType)) {
    const componentsFromNames = realm.react.componentsFromNames;

    if (componentsFromNames.has(name)) {
      const component = componentsFromNames.get(name);
      return component.defaultPropsObjectExpression;
    }
  }
  return null;
}

function evaluateJSXAttributes(
  elementType,
  astAttributes,
  astChildren,
  strictCode,
  env,
  realm,
) {
  let attributes = new Map();
  let children = evaluateJSXChildren(astChildren, strictCode, env, realm);
  const defaultPropsObjectExpression = getDefaultProps(elementType, realm);

  if (defaultPropsObjectExpression !== null) {
    defaultPropsObjectExpression.properties.forEach(property => {
      let name;
      if (property.key.type === 'Identifier') {
        name = property.key.name;
      }
      attributes.set(
        name,
        GetValue(realm, env.evaluate(property.value, strictCode))
      );
    });
  }
  for (let astAttribute of astAttributes) {
    switch (astAttribute.type) {
      case 'JSXAttribute':
        let {name, value} = astAttribute;
        if (name.type !== 'JSXIdentifier') {
          throw new Error(
            'JSX attribute name type not supported: ' + astAttribute.type
          );
        }
        attributes.set(
          name.name,
          evaluateJSXValue(value, strictCode, env, realm)
        );
        break;
      case 'JSXSpreadAttribute':
        debugger;
        break;
      default:
        throw new Error('Unknown JSX attribute type: ' + astAttribute.type);
    }
  }
  return {
    attributes,
    children
  };
}

function evaluateJSXChildren(children, strictCode, env, realm) {
  if (children.length === 0) {
    return null;
  }
  if (children.length === 1) {
    const singleChild = evaluateJSXValue(children[0], strictCode, env, realm);

    if (singleChild instanceof StringValue) {
      const lines = [];
      cleanJSXElementLiteralChild({value: singleChild.value}, lines);
      singleChild.value = lines[0].value;
    }
    return singleChild;
  }
  let array = ArrayCreate(realm, 0);
  let dynamicChildrenLength = children.length;
  let dynamicIterator = 0;
  let lastChildValue = null;
  for (let i = 0; i < children.length; i++) {
    let value = evaluateJSXValue(children[i], strictCode, env, realm);
    if (value instanceof StringValue) {
      const lines = [];
      cleanJSXElementLiteralChild({value: value.value}, lines);
      if (lines.length === 0) {
        dynamicChildrenLength--;
        // this is a space full of whitespace, so let's proceed
        continue;
      } else {
        value.value = lines[0].value;
      }
    }
    lastChildValue = value;
    CreateDataPropertyOrThrow(realm, array, '' + dynamicIterator, value);
    dynamicIterator++;
  }
  if (dynamicChildrenLength === 1) {
    return lastChildValue;
  }

  Set(realm, array, 'length', new NumberValue(realm, dynamicChildrenLength), false);
  return array;
}

module.exports = function(ast, strictCode, env, realm) {
  const openingElement = ast.openingElement;
  const type = evaluateJSXIdentifier(
    openingElement.name,
    strictCode,
    env,
    realm
  );
  const {attributes, children} = evaluateJSXAttributes(
    openingElement.name,
    openingElement.attributes,
    ast.children,
    strictCode,
    env,
    realm
  );
  let key = attributes.get('key') || realm.intrinsics.null;
  let ref = attributes.get('ref') || realm.intrinsics.null;

  if (key === realm.intrinsics.undefined) {
    key = realm.intrinsics.null;
  }
  if (ref === realm.intrinsics.undefined) {
    ref = realm.intrinsics.null;
  }

  if (key !== realm.intrinsics.null && key instanceof ConcreteValue) {
    key = new StringValue(realm, ToString(realm, key));
  }
  const props = createReactProps(realm, type, attributes, children, env);

  return createReactElement(realm, type, key, ref, props);
};
