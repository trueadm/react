/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const t = require('babel-types');
const evaluator = require('./evaluator');

const Types = {
  ANY: 'any',
  ANY_REQUIRED: 'any_isRequired',
  OBJECT: 'object',
  OBJECT_REQUIRED: 'object_isRequired',
  ARRAY: 'array',
  ARRAY_REQUIRED: 'array_isRequired',
  STRING: 'string',
  STRING_REQUIRED: 'string_isRequired',
  NUMBER: 'number',
  NUMBER_REQUIRED: 'number_isRequired',
  NODE: 'node',
  ELEMENT: 'element',
  BOOL: 'bool',
  BOOL_REQUIRED: 'bool_isRequired',
  FUNC: 'func',
  FUNC_REQUIRED: 'func_isRequired',
  SYMBOL: 'symbol',
  ONE_OF: 'one_of',
  INSTANCE_OF: 'instance_of',
  SHAPE: 'shape',
};

function convertAccessorsToNestedObject(accessors, propTypes, deepAccessors) {
  const keys = accessors ? Array.from(accessors.keys()) : [];
  const propKeys = propTypes ? Array.from(propTypes.keys()) : [];

  if (keys.length > 0 || propKeys.length > 0) {
    const object = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = accessors.get(key);
      if (
        deepAccessors === true &&
        value.accessors !== undefined &&
        value.accessors.size > 0
      ) {
        object[key] = convertAccessorsToNestedObject(
          value.accessors,
          null,
          deepAccessors
        );
      } else if (
        deepAccessors === true &&
        value.accessors !== undefined &&
        value.accessedAsSpread === true
      ) {
        object[key] = {};
      } else {
        object[key] = Types.ANY;
      }
    }
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i];
      let value = propTypes.get(key);

      if (value.type === 'FunctionCall') {
        switch (value.identifier) {
          case Types.ONE_OF: {
            const properties = value.args[0].properties;
            let typeOf = null;
            let mixedTypes = false;
            Array.from(properties.values()).forEach(val => {
              if (typeOf === null) {
                typeOf = typeof val;
              } else if (typeof val !== typeOf) {
                mixedTypes = true;
              }
            });
            if (mixedTypes === false) {
              value = typeOf;
            } else {
              value = Types.ANY;
            }
            break;
          }
          case Types.SHAPE: {
            const properties = value.args[0].properties;
            const newObj = {};
            Array.from(properties.keys()).forEach(key => {
              const subValue = properties.get(key);
              if (typeof subValue === 'string') {
                newObj[key] = subValue;
              } else if (subValue.type === 'AbstractValue') {
                newObj[key] = Types.ANY;
              } else {
                // TODO
                throw new Error(
                  'A complex deeply nested shape() PropType was used. No support yet!'
                );
              }
            });
            value = newObj;
            break;
          }
          default:
            value = Types.ANY;
        }
      } else if (
        value.type === 'ConditionalExpression' ||
        value.type === 'AbstractValue'
      ) {
        // TODO
        // as we are inlikely to know this statically, let's assume any
        value = Types.ANY;
      } else if (value.type === 'Function') {
        // if we have an astNode here, pass it back
        const astNode = value.astNode;
        if (astNode !== null) {
          value = () => astNode;
        } else {
          debugger;
        }
      } else if (value.type !== undefined) {
        debugger;
      }
      if (typeof object[key] !== 'object') {
        object[key] = value;
      } else {
        debugger;
      }
    }
    return object;
  }
  return null;
}

function convertNestedObjectToAst(object) {
  return t.objectExpression(
    Object.keys(object).map(key => {
      const value = object[key];
      if (typeof value === 'object') {
        return t.objectProperty(
          t.identifier(key),
          convertNestedObjectToAst(value)
        );
      } else {
        let valueAst = t.nullLiteral();
        if (typeof value === 'function') {
          valueAst = value();
        } else if (typeof value === 'string') {
          valueAst = t.stringLiteral(value);
        } else if (typeof value === 'number') {
          valueAst = t.numericLiteral(value);
        } else if (typeof value === 'boolean') {
          valueAst = t.booleanLiteral(value);
        } else {
          debugger;
        }
        return t.objectProperty(t.identifier(key), valueAst);
      }
    })
  );
}

// this will add additioal prefixed aliases to all prefixes one level deep
// i.e. this.state.foo => this.state.PREFIX_foo
// i.e. this.state.foo.bar => this.state.PREFIX_foo.bar
function convertNestedObjectWithPrefixesToAst(
  object,
  prefix,
  aliasKey,
  moduleEnv,
  hasAppliedPrefix
) {
  return t.objectExpression(
    Object.keys(object).map(key => {
      const value = object[key];
      if (typeof value === 'object') {
        let childHasAppliedPrefix = hasAppliedPrefix;
        let ident = `${prefix}$_$${key}`;
        if (hasAppliedPrefix === false && prefix.startsWith('this')) {
          if (key !== 'props' && key !== 'state') {
            ident = `${prefix}$_$${aliasKey}${key}`;
            childHasAppliedPrefix = true;
          }
        }
        return t.objectProperty(
          t.identifier(key),
          convertNestedObjectWithPrefixesToAst(
            value,
            ident,
            aliasKey,
            moduleEnv,
            childHasAppliedPrefix
          )
        );
      } else {
        let ident = `$F$${prefix}$_$${key}`;
        if (hasAppliedPrefix === false) {
          ident = `$F$${prefix}$_$${aliasKey}${key}`;
        }
        moduleEnv.declare(ident, evaluator.createAbstractValue(ident));
        return t.objectProperty(t.identifier(key), t.identifier(ident));
      }
    })
  );
}

function setAbstractPropsUsingNestedObject(oldValue, object, prefix, root) {
  const oldProperties = oldValue.properties;
  let properties = oldProperties;
  let value = oldValue;
  if (!root) {
    // TODO this should be a partial?
    value = evaluator.createAbstractObject(prefix);
    value.properties = properties;
  }
  Object.keys(object).forEach(key => {
    const value = object[key];
    const newPrefix = `${prefix}.${key}`;

    if (typeof value === 'object') {
      properties.get(key).descriptor.value = setAbstractPropsUsingNestedObject(
        properties.get(key).descriptor.value,
        value,
        newPrefix,
        false
      );
    } else {
      switch (value) {
        // simple abstract objects
        case Types.ARRAY_REQUIRED:
          properties.get(key).descriptor.value = evaluator.createAbstractArray(
            newPrefix
          );
          break;
        case Types.OBJECT:
        case Types.OBJECT_REQUIRED:
          properties.get(key).descriptor.value = evaluator.createAbstractObject(
            newPrefix
          );
          break;
        case Types.NUMBER_REQUIRED:
          properties.get(key).descriptor.value = evaluator.createAbstractNumber(
            newPrefix
          );
          break;
        case Types.STRING_REQUIRED:
          properties.get(key).descriptor.value = evaluator.createAbstractString(
            newPrefix
          );
          break;
        case Types.FUNC_REQUIRED:
          properties.get(
            key
          ).descriptor.value = evaluator.createAbstractFunction(newPrefix);
          break;
        case Types.BOOL_REQUIRED:
          properties.get(
            key
          ).descriptor.value = evaluator.createAbstractBoolean(newPrefix);
          break;
        case Types.STRING:
          // not correct but we're cheating for now
          properties.get(key).descriptor.value = evaluator.createAbstractString(
            newPrefix
          );
          break;
        // generic abstract value
        default: {
          properties.get(key).descriptor.value = evaluator.createAbstractValue(
            newPrefix
          );
        }
      }
    }
  });
  return value;
}

module.exports = {
  convertAccessorsToNestedObject,
  convertNestedObjectToAst,
  setAbstractPropsUsingNestedObject,
  convertNestedObjectWithPrefixesToAst,
  Types,
};
