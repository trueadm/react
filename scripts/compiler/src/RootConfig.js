/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

const { UndefinedValue } = require("prepack/lib/values");
const traverser = require("./traverser");
const t = require("babel-types");
const serializer = require("./serializer");

// this can be done better
function filterConstructorProperties(object, constructorProperties) {
  if (object !== null) {
    if (Array.isArray(object)) {
      object.forEach(child => {
        filterConstructorProperties(child, constructorProperties);
      });
      return;
    } else if (object.type === "ExpressionStatement") {
      const expression = object.expression;

      filterConstructorProperties(expression, constructorProperties);
      return;
    } else if (object.type === "ReturnStatement") {
      // remove return statements
      if (object.argument.type === "SequenceExpression") {
        filterConstructorProperties(
          object.argument.expressions,
          constructorProperties
        );
      } else {
        debugger;
      }
      return;
    } else if (
      // remove Super(...)
      object.type === "CallExpression" &&
      object.callee.type === "Super"
    ) {
      return;
    } else if (object.type === "AssignmentExpression") {
      // remove ... = Super(...)
      if (
        object.right.type === "CallExpression" &&
        object.right.callee.type === "Super"
      ) {
        return;
      }
      // remove this.state = ...
      if (
        object.left.type === "MemberExpression" &&
        object.left.object.type === "ThisExpression" &&
        object.left.property.type === "Identifier" &&
        object.left.property.name === "state"
      ) {
        return;
      }
    } else if (object.type === "Identifier") {
      // NO-OP
      return;
    }
    if (object.type.indexOf("Expression") !== -1) {
      constructorProperties.push(t.expressionStatement(object));
    } else {
      constructorProperties.push(object);
    }
  }
}

function mergeLifecycleMethod(
  name,
  lifecycleMethod,
  lifecycleMethods,
  prototypeProperties,
  entry,
  rootConfig
) {
  if (lifecycleMethods[name] === undefined) {
    lifecycleMethods[name] = t.classMethod(
      lifecycleMethod.kind,
      lifecycleMethod.key,
      lifecycleMethod.params,
      t.blockStatement([])
    );
    prototypeProperties.push(lifecycleMethods[name]);
  }
  // we pass in nextProps, so we need to treat this as a props alias for the properties of this.props
  let propsAliases = {};
  if ((
    name === 'componentWillReceiveProps' ||
    name === 'componentWillUpdate' ||
    name === 'componentDidUpdate'
   ) && lifecycleMethod.params.length > 0) {
    const nextPropsName = lifecycleMethod.params[0].name;
    propsAliases[nextPropsName] = true;
  }
  // we don't merge sCU
  if (name !== 'shouldComponentUpdate') {
    lifecycleMethod.body.body.forEach(lifecycleStatement => {
      lifecycleMethods[name].body.body.push(
        addPrefixesToAstNodes(cloneAst(lifecycleStatement), entry, rootConfig, propsAliases)
      );
    });
  }
}

function findFirstMemberNodeOfMemberExpression(node) {
  while (node.type !== "Identifier") {
    if (node.type === "MemberExpression") {
      if (node.object.type === "ThisExpression") {
        node.property.parentNode = node;
        node = node.property;
      } else {
        node.object.parentNode = node;
        node = node.object;
      }
    }
  }
  return node;
}

function getNextMemberNodeOfMemberExpression(rootNode, prevNode) {
  let parentNode = prevNode.parentNode;
  if (parentNode === undefined) {
    if (rootNode.property === prevNode) {
      return null;
    }
    return rootNode.property;
  } else if (parentNode.object === prevNode) {
    return parentNode.property;
  } else if (parentNode.parentNode !== undefined) {
    return parentNode.parentNode.property;
  }
  return rootNode.property;
}

const blacklist = {
  state: true,
  props: true,
  context: true,
  refs: true,
  setState: true,
  forceUpdate: true,
  displayName: true,
  defaultProps: true
};

function renamePropsObject(node, firstNode, propsValue, rootConfig) {
  // we need to replace with correct props
  const nextNode = getNextMemberNodeOfMemberExpression(node, firstNode);
  const lastNode = getNextMemberNodeOfMemberExpression(node, nextNode);
  const memberName = nextNode.name;
  const propValue = propsValue.properties.get(memberName);
  let memberNode = null;
  if (propValue !== undefined) {
    const value = propValue.descriptor.value;
    if (value.isIntrinsic()) {
      // $F$ is the this.state.foo relabelling
      if (value.intrinsicName.indexOf("$F$") === 0) {
        memberNode = serializer.convertStringToExpressionWithDelimiter(
          value.intrinsicName,
          "$_$",
          3
        );
      }
    }
    if (memberNode === null) {
      if (typeof value.buildNode !== "function") {
        if (value instanceof UndefinedValue) {
          return t.identifier("undefined");
        }
      }
      memberNode = serializer.convertValueToExpression(
        value,
        rootConfig
      );
    }
    if (lastNode !== null) {
      return t.memberExpression(memberNode, lastNode);
    }
    // debugger;
    return memberNode;
  }
}

function addPrefixesToAstNodes(entryNode, entry, rootConfig, propsAliases) {
  const theClass = entry.theClass;
  let thisAccessors = null;
  if (theClass !== null) {
    thisAccessors = theClass.thisObject.accessors;
  }
  const func = entry.func;
  let propsArgument = null;
  if (func !== null) {
    propsArgument = func.params.length > 0 ? func.params[0] : null;
  }
  let propsName = null;
  if (propsArgument !== null && propsArgument.astNode !== null) {
    if (propsArgument.astNode.type === 'Identifier') {
      propsName = propsArgument.astNode.name;
    } else {
      debugger;
    }
  }
  const prefix = entry.key;
  const propsValue = entry.props;
  const scope = traverser.createModuleScope();
  scope.findAndReplace = {
    CallExpression(node) {
      // prefix setState calls
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.object.type === "ThisExpression" &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "setState"
      ) {
        const args = node.arguments;
        // TODO need to handle way more setState cases than this
        // when the argument is an object
        if (args.length > 0 && args[0].type === 'ObjectExpression') {
          args[0] = t.objectExpression(
            args[0].properties.map(property => {
              if (property.type === 'ObjectProperty') {
                if (property.key.type === 'Identifier') {
                  return t.objectProperty(t.identifier(prefix + property.key.name), property.value);
                }
                debugger;
              } else {
                debugger;
              }
            })
          );
        }
      }
    },
    MemberExpression(node) {
      if (node.object.type === 'Identifier' && propsAliases[node.object.name]) {
        // this handles props aliases
        const newNode = cloneAst(renamePropsObject(node, node.object, propsValue, rootConfig));
        // we now get back this.props.X.Y.Z, we need to replace this.props with the propAlias
        const subScope = traverser.createModuleScope();
        subScope.findAndReplace = {
          MemberExpression(subNode) {
            if (subNode.object.type === 'ThisExpression' && subNode.property.type === 'Identifier' && subNode.property.name === 'props') {
              return node.object;
            }
          },
        };
        traverser.traverse(newNode, traverser.Actions.FindAndReplace, subScope);
        return newNode;
      } else if (propsArgument !== null && node.object.type === 'Identifier' && propsName === node.object.name) {
        return renamePropsObject(node, node.object, propsValue, rootConfig);
      } else if (node.object.type === "ThisExpression") {
        // handle this.* instance properties/methods
        const firstNode = findFirstMemberNodeOfMemberExpression(node.property);

        const name = firstNode.name;
        if (thisAccessors !== null && thisAccessors.has(name) && blacklist[name] !== true) {
          firstNode.name = prefix + name;
        }
        return true;
      } else if (node.object.type === "MemberExpression") {
        // handle this.state and this.props
        const firstNode = findFirstMemberNodeOfMemberExpression(node.object);
        const name = firstNode.name;
        if (name === "state") {
          const property = getNextMemberNodeOfMemberExpression(node, firstNode);
          property.name = prefix + property.name;
          return true;
        } else if (name === "props") {
          return renamePropsObject(node, firstNode, propsValue, rootConfig);
        }
      }
    },
  };
  traverser.traverse(entryNode, traverser.Actions.FindAndReplace, scope);
  return entryNode;
}
function cloneAst(astNode) {
  if (Array.isArray(astNode)) {
    const arr = new Array(astNode.length);
    for (let i = 0; i < astNode.length; i++) {
      arr[i] = cloneAst(astNode[i]);
    }
    return arr;
  }
  const newNode = astNode.__clone !== undefined ? astNode.__clone() : {};
  for (let key in astNode) {
    const value = astNode[key];
    if (Array.isArray(value)) {
      const arr = (newNode[key] = new Array(value.length));
      for (let i = 0; i < value.length; i++) {
        arr[i] = cloneAst(value[i]);
      }
    } else if (
      typeof value === "object" &&
      value !== null &&
      key !== "class" &&
      key !== "func" &&
      key !== "scope" &&
      key !== "loc" &&
      key !== "jsxElement"
    ) {
      // these are all the custom properties we add to AST nodes to help get access to things (monkey-patchy), we want to skip cloninig them when cloining
      newNode[key] = cloneAst(value);
    } else {
      newNode[key] = value;
    }
  }
  return newNode;
}

class RootConfig {
  constructor(moduleEnv) {
    this._entries = new Set();
    this._entriesCache = null;
    this.moduleEnv = moduleEnv;
    this.useClassComponent = false;
  }
  addEntry(props, theClass, func) {
    const key =
      Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 3) + "_";
    const entry = {
      constructorProperties: null,
      key,
      props,
      prototypeProperties: null,
      state: null,
      theClass,
      func,
    };

    this._entries.add(entry);
    return {
      rootConfigEntry: entry,
      entryKey: key
    };
  }
  _getEntries() {
    if (this._entriesCache === null) {
      this._entriesCache = Array.from(this._entries.values());
    }
    return this._entriesCache;
  }
  getPrototypeProperties() {
    const entries = this._getEntries();
    const prototypeProperties = [];
    const lifecycleMethods = {};
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const theClass = entry.theClass;
      if (entry.prototypeProperties !== null) {
        entry.prototypeProperties.forEach(prototypeProperty => {
          // skip it if it starts with _render
          const name = prototypeProperty.key.name;
          if (
            name === "componentWillMount" ||
            name === "componentWillUpdate" ||
            name === 'componentDidMount' ||
            name === "componentDidUpdate" ||
            name === "componentWillUnmount" ||
            name === "shouldComponentUpdate" ||
            name === "componentWillReceiveProps" ||
            name === "componentDidCatch"
          ) {
            mergeLifecycleMethod(
              name,
              prototypeProperty,
              lifecycleMethods,
              prototypeProperties,
              entry,
              this
            );
            return;
          }
          if (theClass !== null) {
            const thisObject = entry.theClass.thisObject;
            const methods = entry.theClass.methods;
            if (
              methods.has(name) &&
              thisObject.properties.has(name) &&
              traverser.handleMultipleValues(thisObject.properties.get(name))
                .callSites.length > 0
            ) {
              // strip out render methods entirely
              if (name.startsWith("_render") || name.startsWith("render")) {
                return;
              }
            }
          }
          prototypeProperties.push(
            t.classMethod(
              prototypeProperty.kind,
              t.identifier(entry.key + prototypeProperty.key.name),
              prototypeProperty.params,
              addPrefixesToAstNodes(
                cloneAst(prototypeProperty.body),
                entry,
                this,
                {}
              )
            )
          );
        });
      }
    }
    return prototypeProperties;
  }
  getConstructorProperties() {
    const entries = this._getEntries();
    let allConstructorProperties = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.constructorProperties !== null) {
        if (allConstructorProperties === null) {
          allConstructorProperties = [];
        }
        const constructorProperties = cloneAst(entry.constructorProperties);
        addPrefixesToAstNodes(
          t.blockStatement(constructorProperties),
          entry,
          this,
          {}
        );
        filterConstructorProperties(
          constructorProperties,
          allConstructorProperties
        );
      }
    }
    return allConstructorProperties;
  }
  getMergedState() {
    const entries = this._getEntries();
    let mergedState = null;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.state !== null) {
        if (mergedState === null) {
          mergedState = t.objectExpression([]);
        }
        entry.state.properties.forEach(originalProperty => {
          mergedState.properties.push(
            t.objectProperty(
              t.identifier(entry.key + originalProperty.key.name),
              addPrefixesToAstNodes(
                cloneAst(originalProperty.value),
                entry,
                this,
                {}
              )
            )
          );
        });
      }
    }
    return mergedState;
  }
}

module.exports = RootConfig;
