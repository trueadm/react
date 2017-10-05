"use strict";

const {
  AbstractValue,
  ArrayValue,
  BooleanValue,
  FunctionValue,
  ObjectValue,
  NumberValue,
  StringValue,
  NullValue,
  UndefinedValue,
  ECMAScriptSourceFunctionValue,
  NativeFunctionValue
} = require("prepack/lib/values");
const ComponentTree = require("./ComponentTree");
const {call} = require('../prepack/evaluator');
const t = require("babel-types");

function isReactElement(value) {
  return value instanceof ObjectValue && value.properties.has("$$typeof");
}

function isReactClassComponent(type) {
  if (!(type instanceof FunctionValue)) {
    return false;
  }
  // Any ES6 class supported for now.
  return type.$FunctionKind === "classConstructor";
}

class Reconciler {
  constructor(react, realm, stats) {
    this.react = react;
    this.realm = realm;
    realm.react = react;
    this.rootConfig = new ComponentTree();
    this.stats = stats;
  }
  render(component) {
    const componentType = component.type;
    const initialProps = component.getInitialProps();
    const initialContext = component.getInitialContext();
    try {
      const {result} = this._renderAsDeepAsPossible(
        componentType,
        initialProps,
        initialContext,
        false
      );
      return result;
    } catch (e) {
      console.log(e.stack);
      return null;
    }
  }
  _renderAsDeepAsPossible(
    componentType,
    props,
    context,
    isBranched
  ) {
    const {value, commitDidMountPhase, childContext} = this._renderOneLevel(
      componentType,
      props,
      context,
      isBranched
    );
    const result = this._resolveDeeply(value, childContext, isBranched);
    return {
      result,
      childContext,
      commitDidMountPhase,
    };
  }
  _renderOneLevel(
    componentType,
    props,
    context
  ) {
    if (isReactClassComponent(componentType)) {
    } else {
      if (componentType.$Call !== undefined) {
        const value = call(componentType, undefined, [props, context]);
        return {value, commitDidMountPhase: null, childContext: context};
      }
    }
  }
  _resolveDeeply(value, context, isBranched) {
    if (
      value instanceof StringValue ||
      value instanceof NumberValue ||
      value instanceof BooleanValue ||
      value instanceof NullValue ||
      value instanceof UndefinedValue
    ) {
      // Terminal values
      return value;
    } else if (value instanceof AbstractValue) {
      for (let i = 0; i < value.args.length; i++) {
        value.args[i] = this._resolveDeeply(
          value.args[i],
          context,
          true
        );
      }
      return value;
    }
    if (value instanceof ArrayValue) {
      this._resolveFragment(value, context, isBranched);
      return value;
    }
    if (isReactElement(value)) {
      const type = value.properties.get("type").descriptor.value;
      const props = value.properties.get("props").descriptor.value;
      const ref = value.properties.get("ref").descriptor.value;
      if (type instanceof StringValue) {
        // Terminal host component. Start evaluating its children.
        const childrenProperty = props.properties.get("children");
        if (childrenProperty && childrenProperty.descriptor) {
          const resolvedChildren = this._resolveDeeply(
            childrenProperty.descriptor.value,
            context,
            isBranched
          );
          childrenProperty.descriptor.value = resolvedChildren;
        }
        return value;
      }
      let name;
      if (!(ref instanceof NullValue)) {
        console.log(
          `Failed to inline component "${name}" as there was a ref on the ReactElement, this is not supported on components.`
        );
        return value;
      }
      try {
        const {result, commitDidMountPhase} = this._renderAsDeepAsPossible(
          type,
          props,
          context,
          isBranched
        );
        if (result === null) {
          if (name !== undefined) {
            console.log(
              `Failed to inline component "${name}" as the reference wasn't a statically determinable function or class.`
            );
          }
          return value;
        }
        if (result instanceof UndefinedValue) {
          if (name !== undefined) {
            console.log(
              `Failed to inline component "${name}" as the render returned an undefined value.`
            );
          }
          return value;
        }
        this.stats.inlinedComponents++;
        if (commitDidMountPhase !== null) {
          commitDidMountPhase();
        }
        return result;
      } catch (e) {
        if (name !== undefined) {
          if (
            e.stack.indexOf("A fatal error occurred while prepacking") !== -1 ||
            e.stack.indexOf("Invariant Violation") !== -1
          ) {
            console.log(
              `Failed to inline component "${name}" due to a Prepack evaluation error:\n- ${e.stack}`
            );
          } else {
            console.log(
              `Failed to inline component "${name}" due to:\n${e.message}`
            );
          }
        }
        return value;
      }
    } else {
      return value;
    }
  }
  _resolveFragment(arrayValue, context, isBranched) {
    let lengthProperty = arrayValue.properties.get("length");
    if (
      !lengthProperty ||
      !(lengthProperty.descriptor.value instanceof NumberValue)
    ) {
      throw new Error("Invalid length");
    }
    let length = lengthProperty.descriptor.value.value;
    for (let i = 0; i < length; i++) {
      let elementProperty = arrayValue.properties.get("" + i);
      let elementValue =
        elementProperty &&
        elementProperty.descriptor &&
        elementProperty.descriptor.value;
      if (elementValue) {
        elementProperty.descriptor.value = this._resolveDeeply(
          elementValue,
          context,
          isBranched
        );
      }
    }
  }
}

module.exports = Reconciler;
