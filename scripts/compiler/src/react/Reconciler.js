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

function resolveFragment(arrayValue, context, moduleEnv, rootConfig, isBranched) {
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
      elementProperty.descriptor.value = resolveDeeply(
        elementValue,
        context,
        moduleEnv,
        rootConfig,
        isBranched
      );
    }
  }
}

function resolveDeeply(value, context, moduleEnv, rootConfig, isBranched) {
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
      value.args[i] = resolveDeeply(
        value.args[i],
        context,
        moduleEnv,
        rootConfig,
        true
      );
    }
    return value;
  }
  if (value instanceof ArrayValue) {
    resolveFragment(value, context, moduleEnv, rootConfig, isBranched);
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
        const resolvedChildren = resolveDeeply(
          childrenProperty.descriptor.value,
          context,
          moduleEnv,
          rootConfig,
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
      const {result, commitDidMountPhase} = renderAsDeepAsPossible(
        type,
        props,
        context,
        moduleEnv,
        rootConfig,
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
      // inlinedComponents++;
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

function renderOneLevel(
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

function renderAsDeepAsPossible(
  componentType,
  props,
  context,
  moduleEnv,
  rootConfig,
  isBranched
) {
  const {value, commitDidMountPhase, childContext} = renderOneLevel(
    componentType,
    props,
    context,
    moduleEnv,
    rootConfig,
    isBranched
  );
  const result = resolveDeeply(value, childContext, moduleEnv, rootConfig, isBranched);
  return {
    result,
    childContext,
    commitDidMountPhase,
  };
}

class Reconciler {
  constructor(react, moduleEnv) {
    this.react = react;
    this.moduleEnv = moduleEnv;
    this.realm = moduleEnv.lexicalEnvironment.realm;
    this.rootConfig = new ComponentTree(moduleEnv);
  }
  render(component) {
    const componentType = component.type;
    const initialProps = component.getInitialProps();
    const initialContext = component.getInitialContext();
    try {
      const {result} = renderAsDeepAsPossible(
        componentType,
        initialProps,
        initialContext,
        this.moduleEnv,
        this.rootConfig,
        false
      );
      return result;
    } catch (e) {
      console.log(e.stack);
      return null;
    }
  }
}

module.exports = Reconciler;
