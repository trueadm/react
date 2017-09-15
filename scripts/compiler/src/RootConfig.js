'use strict';

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
const traverser = require('./traverser');
const t = require('babel-types');
const serializer = require('./serializer');

// this can be done better
function filterConstructorProperties(object, constructorProperties) {
  if (object !== null) {
    if (Array.isArray(object)) {
      object.forEach(child => {
        filterConstructorProperties(child, constructorProperties);
      });
      return;
    } else if (object.type === 'ExpressionStatement') {
      const expression = object.expression;

      filterConstructorProperties(expression, constructorProperties);
      return;
    } else if (object.type === 'ReturnStatement') {
      // remove return statements
      if (object.argument.type === 'SequenceExpression') {
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
      object.type === 'CallExpression' &&
      object.callee.type === 'Super'
    ) {
      return;
    } else if (object.type === 'AssignmentExpression') {
      // remove ... = Super(...)
      if (
        object.right.type === 'CallExpression' &&
        object.right.callee.type === 'Super'
      ) {
        return;
      }
      // remove this.state = ...
      if (
        object.left.type === 'MemberExpression' &&
        object.left.object.type === 'ThisExpression' &&
        object.left.property.type === 'Identifier' &&
        object.left.property.name === 'state'
      ) {
        return;
      }
    } else if (object.type === 'Identifier') {
      // NO-OP
      return;
    }
    if (object.type.indexOf('Expression') !== -1) {
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
  lifecycleMethod.body.body.forEach(lifecycleStatement => {
    lifecycleMethods[name].body.body.push(
      addPrefixesToAstNodes(cloneAst(lifecycleStatement), entry, rootConfig)
    );
  });
}

function findFirstMemberNodeOfMemberExpression(node) {
  while (node.type !== 'Identifier') {
    if (node.type === 'MemberExpression') {
      if (node.object.type === 'ThisExpression') {
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
  defaultProps: true,
};

function addPrefixesToAstNodes(entryNode, entry, rootConfig) {
  const thisAccessors = entry.theClass.thisObject.accessors;
  const prefix = entry.key;
  const propsValue = entry.props;
  const scope = traverser.createModuleScope();
  scope.findAndReplace = {
    MemberExpression(node) {
      if (node.object.type === 'ThisExpression') {
        // handle this.* instance properties/methods
        const firstNode = findFirstMemberNodeOfMemberExpression(node.property);

        const name = firstNode.name;
        if (thisAccessors.has(name) && blacklist[name] !== true) {
          firstNode.name = prefix + name;
        }
        return true;
      } else if (node.object.type === 'MemberExpression') {
        // handle this.state and this.props
        const firstNode = findFirstMemberNodeOfMemberExpression(node.object);
        const name = firstNode.name;
        if (name === 'state') {
          const property = getNextMemberNodeOfMemberExpression(node, firstNode);
          property.name = prefix + property.name;
          return true;
        } else if (name === 'props') {
          // we need to replace with correct props
          const nextNode = getNextMemberNodeOfMemberExpression(node, firstNode);
          const lastNode = getNextMemberNodeOfMemberExpression(node, nextNode);
          const memberName = nextNode.name;
          const propValue = propsValue.properties.get(memberName);
          let memberNode = null;
          if (propValue !== undefined) {
            const value = propValue.descriptor.value;
            if (value.isIntrinsic()) {
              if (value.intrinsicName.indexOf('$F$') === 0) {
                memberNode = serializer.convertPrefixPlaceholderToExpression(
                  value.intrinsicName
                );
              }
            }
            if (memberNode === null) {
              if (typeof value.buildNode !== 'function') {
                if (value instanceof UndefinedValue) {
                  return t.identifier('undefined');
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
            return memberNode;
          }
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
      typeof value === 'object' &&
      value !== null &&
      key !== 'class' &&
      key !== 'func' &&
      key !== 'scope' &&
      key !== 'loc' &&
      key !== 'jsxElement'
    ) {
      // these are all the custom properties we add to AST nodes to help get access to things (monkey-patchy), we want to skip cloninig them when cloining
      newNode[key] = cloneAst(value);
    }
  }
  return newNode;
}

class RootConfig {
  constructor() {
    this._entries = new Set();
    this._entriesCache = null;
    this.useClassComponent = false;
  }
  addEntry(props, theClass) {
    const key =
      Math.random().toString(36).replace(/[^a-z]+/g, '').substring(0, 3) + '_';
    const entry = {
      constructorProperties: null,
      key: key,
      props: props,
      prototypeProperties: null,
      state: null,
      theClass: theClass,
    };

    this._entries.add(entry);
    return {
      rootConfigEntry: entry,
      entryKey: key,
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
      const thisObject = entry.theClass.thisObject;
      const methods = entry.theClass.methods;
      if (entry.prototypeProperties !== null) {
        entry.prototypeProperties.forEach(prototypeProperty => {
          // skip it if it starts with _render
          const name = prototypeProperty.key.name;
          if (
            name === 'componentWillMount' ||
            name === 'componentDidMount' ||
            name === 'componentWillUpdate' ||
            name === 'componentDidUpdate' ||
            name === 'componentWillUnmount' ||
            name === 'shouldComponentUpdate' ||
            name === 'componentWillReceiveProps' ||
            name === 'componentDidCatch'
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
          if (
            methods.has(name) &&
            thisObject.properties.has(name) &&
            thisObject.properties.get(name).callSites.length > 0
          ) {
            // strip out render methods entirely
            if (name.startsWith('_render') || name.startsWith('render')) {
              return;
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
                this
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
          this
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
                this
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
