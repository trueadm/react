"use strict";

const traverser = require("./traverser");
const t = require("babel-types");

function filterConstructorProperties(object, bodyBlock) {
  if (object !== null) {
    if (Array.isArray(object)) {
      object.forEach(child => {
        // skip this.state and super() expressions
        filterConstructorProperties(child, bodyBlock);
      });
      return;
    } else if (object.type === "ExpressionStatement") {
      const expression = object.expression;

      filterConstructorProperties(expression, bodyBlock);
      return;
    } else if (object.type === "ReturnStatement") {
      // we don't want return statements
      if (object.argument.type === "SequenceExpression") {
        filterConstructorProperties(object.argument.expressions, bodyBlock);
      } else {
        debugger;
      }
      return;
    } else if (
      // Super(...)
      object.type === "CallExpression" &&
      object.callee.type === "Super"
    ) {
      return;
    } else if (object.type === "AssignmentExpression") {
      // = Super(...)
      if (
        object.right.type === "CallExpression" &&
        object.right.callee.type === "Super"
      ) {
        return;
      }
      // this.state = ...
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
      bodyBlock.push(t.expressionStatement(object));
    } else {
      bodyBlock.push(object);
    }
  }
}

function mergeLifecycleMethod(
  name,
  lifecycleMethod,
  lifecycleMethods,
  prototypeProperties
) {
  if (lifecycleMethods[name] === undefined) {
    lifecycleMethods[name] = lifecycleMethod;
    prototypeProperties.push(lifecycleMethod);
  } else {
    lifecycleMethod.body.body.forEach(componentWillMountStatement => {
      lifecycleMethods[name].body.body.push(componentWillMountStatement);
    });
  }
}

class RootConfig {
  constructor() {
    this._entries = new Set();
    this._entriesCache = null;
    this.useClassComponent = false;
  }
  addEntry(props) {
    const key =
      Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 3) + "_";
    const entry = {
      constructorProperties: null,
      key: key,
      props: props,
      prototypeProperties: null,
      state: null
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
      if (entry.prototypeProperties !== null) {
        entry.prototypeProperties.forEach(prototypeProperty => {
          // skip it if it starts with _render
          const name = prototypeProperty.key.name;
          if (name.indexOf("_render") === 0 || name.indexOf("render") === 0) {
            // NO OP
            console.log(
              `Did not include prototype method "${name}" as it looks like a render method on an inlined component.`
            );
          } else if (
            name === "componentWillMount" ||
            name === "componentDidMount" ||
            name === "componentWillUpdate" ||
            name === "componentDidUpdate" ||
            name === "componentWillUnmount"
          ) {
            mergeLifecycleMethod(
              name,
              prototypeProperty,
              lifecycleMethods,
              prototypeProperties
            );
          } else {
            prototypeProperties.push(prototypeProperty);
          }
        });
      }
    }
    return prototypeProperties;
  }
  applyFilteredConstructorPropertiesToBlock(bodyBlock) {
    const entries = this._getEntries();
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.constructorProperties !== null) {
        filterConstructorProperties(entry.constructorProperties, bodyBlock);
      }
    }
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
          mergedState.properties.push(t.objectProperty(
            t.identifier(entry.key + originalProperty.key.name),
            originalProperty.value
          ));
        });
      }
    }
    return mergedState;
  }
}

module.exports = RootConfig;
