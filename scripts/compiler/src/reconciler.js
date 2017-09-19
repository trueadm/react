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
  BooleanValue,
  FunctionValue,
  ObjectValue,
  NumberValue,
  StringValue,
  NullValue,
  UndefinedValue
} = require("prepack/lib/values");
const {
  convertAccessorsToNestedObject,
  convertNestedObjectWithPrefixesToAst
} = require("./types");
const t = require("babel-types");
const evaluator = require("./evaluator");

let inlinedComponents = 0;

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

async function resolveFragment(arrayValue, moduleEnv, rootConfig, isBranched) {
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
      elementProperty.descriptor.value = await resolveDeeply(
        elementValue,
        moduleEnv,
        rootConfig,
        isBranched
      );
    }
  }
}

async function resolveDeeply(value, moduleEnv, rootConfig, isBranched) {
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
      value.args[i] = await resolveDeeply(
        value.args[i],
        moduleEnv,
        rootConfig,
        true
      );
    }
    return value;
  }
  if (value instanceof ArrayValue) {
    await resolveFragment(value, moduleEnv, rootConfig, isBranched);
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
        const resolvedChildren = await resolveDeeply(
          childrenProperty.descriptor.value,
          moduleEnv,
          rootConfig,
          isBranched
        );
        childrenProperty.descriptor.value = resolvedChildren;
      }
      return value;
    }
    let name;
    if (type.properties && type.properties.has("name")) {
      name = type.properties.get("name").descriptor.value.value;
    } else if (type.func) {
      name = type.func.name;
    } else {
      name = type.intrinsicName;
    }
    if (!(ref instanceof NullValue)) {
      console.log(
        `Failed to inline component "${name}" as there was a ref on the ReactElement, this is not supported on components.`
      );
      return value;
    }
    try {
      const {result, commitDidMountPhase} = await renderAsDeepAsPossible(
        type,
        props,
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
      inlinedComponents++;
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

function createReactClassInstance(
  componentType,
  props,
  moduleEnv,
  rootConfig,
  isBranched
) {
  // first we find the class object we made during the scan phase, it can be in two places
  let theClass;
  if (componentType.class !== undefined) {
    theClass = componentType.class;
  } else if (componentType.$ECMAScriptCode.class) {
    theClass = componentType.$ECMAScriptCode.class;
  } else {
    debugger;
  }
  // add a rootConfig entry
  const { rootConfigEntry, entryKey } = rootConfig.addEntry(props, theClass, null);
  // we used to use Prepack to construct the component but this generally lead to
  // unwanted effects, as we don't really want to evaluate the code but rather
  // we just want to extract the things we care about and set everything else as abstract
  // specifically we want to create an object for "this" and put back on abstract properties
  // this will also help avoid bail outs and improve how we can inline things
  // we need to be careful not to set render methods to abstract (i.e. this._renderHeader())
  const baseComponent = moduleEnv.eval(
    t.memberExpression(t.identifier("React"), t.identifier("Component")),
    true
  );
  // add all prototype properties on to the BaseComponent
  const baseComponentPrototype = baseComponent.properties.get("prototype")
    .descriptor.value.properties;
  const componentPrototype = componentType.properties.get("prototype")
    .descriptor.value.properties;
  for (let [key, property] of componentPrototype) {
    if (key !== "constructor") {
      baseComponentPrototype.set(key, property);
    }
  }
  const instance = evaluator.construct(baseComponent, [props]);
  const instanceProperties = instance.properties;
  // set props on the new instance
  instanceProperties.get("props").descriptor.value = props;
  // now we need to work out all the instance properties for "this"
  const thisObject = theClass.thisObject;
  const instanceThisShape = convertAccessorsToNestedObject(
    thisObject.accessors,
    null,
    true
  ) || {};
  const instanceThisAstWithPrefixes = convertNestedObjectWithPrefixesToAst(
    instanceThisShape,
    "this",
    entryKey,
    moduleEnv
  );
  let instanceThis = moduleEnv.eval(instanceThisAstWithPrefixes);
  // copy over the instanceThis properties to our instance, minus "props" as we have that already
  let useClassComponent = false;
  if (
    componentPrototype.has("componentWillMount") ||
    componentPrototype.has("componentDidMount") ||
    componentPrototype.has("componentWillUpdate") ||
    componentPrototype.has("componentDidUpdate") ||
    componentPrototype.has("componentWillUnmount") ||
    componentPrototype.has("componentDidCatch") ||
    componentPrototype.has("componentWillReceiveProps")
  ) {
    if (isBranched === true) {
      throw new Error(
        `- Component having lifecycle events when inside a branch.`
      );
    }
    useClassComponent = true;
  }
  // TODO do we need to bail on sCU in branches too?
  if (componentPrototype.has("shouldComponentUpdate")) {
    useClassComponent = true;
  }
  for (let [key, value] of instanceThis.properties) {
    if (key === "state") {
      useClassComponent = true;
      instanceProperties.set(key, value);
    } else if (key !== "props") {
      // if this is a prototype method that is called directly in the component (i.e. lifecycles) then don't make it abstract
      if (
        componentPrototype.has(key) &&
        thisObject.properties.has(key) &&
        thisObject.properties.get(key).callSites !== undefined &&
        thisObject.properties.get(key).callSites.length > 0
      ) {
        // NO-OP
      } else {
        instanceProperties.set(key, value);
        useClassComponent = true;
      }
    }
  }

  // as we may bail out later on, don't actually apply changes to rootConfig until we know all is well
  const commitWillMountPhase = value => {
    if (useClassComponent === true) {
      rootConfig.useClassComponent = true;
    }
    if (thisObject.properties.has("state")) {
      rootConfigEntry.state = thisObject.properties.get("state").astNode;
    }
    for (let [key, property] of componentPrototype) {
      if (key === "constructor") {
        const constructorAstBody =
          property.descriptor.value.$ECMAScriptCode.body;
        rootConfigEntry.constructorProperties = constructorAstBody;
      } else if (key !== "render") {
        if (theClass.methods.has(key)) {
          if (rootConfigEntry.prototypeProperties === null) {
            rootConfigEntry.prototypeProperties = [];
          }
          if (key !== 'componentDidMount' && key !== 'componentDidUpdate') {
            rootConfigEntry.prototypeProperties.push(
              theClass.methods.get(key).astNode
            );
          }
        }
      }
    }
    findAndHoistClosures(value, props, rootConfigEntry, entryKey, rootConfig);
  };

  const commitDidMountPhase = () => {
    if (componentPrototype.has('componentDidMount')) {
      if (rootConfigEntry.prototypeProperties === null) {
        rootConfigEntry.prototypeProperties = [];
      }
      rootConfigEntry.prototypeProperties.push(
        theClass.methods.get('componentDidMount').astNode
      );
    }
    if (componentPrototype.has('componentDidUpdate')) {
      if (rootConfigEntry.prototypeProperties === null) {
        rootConfigEntry.prototypeProperties = [];
      }
      rootConfigEntry.prototypeProperties.push(
        theClass.methods.get('componentDidUpdate').astNode
      );
    }
    rootConfig.componentDidQueue.push(rootConfigEntry);
  };
  return {
    instance,
    commitWillMountPhase,
    commitDidMountPhase,
  };
}

function findAndHoistClosures(
  value,
  propsValue,
  rootConfigEntry,
  entryKey,
  rootConfig,
  func
) {
  if (isReactElement(value)) {
    const closures = [];
    // functions might exist in 2 places, "ref" and "props"
    const props = value.properties.get("props").descriptor.value;
    if (props.properties !== undefined) {
      for (let [key, prop] of props.properties) {
        const propValue = prop.descriptor.value;
        if (propValue instanceof FunctionValue && propValue.$ThisMode === 'lexical') {
          closures.push(propValue);
        }
      }
    }
    const ref = value.properties.get("ref").descriptor.value;
    if (ref instanceof FunctionValue && ref.$ThisMode === 'lexical') {
      closures.push(ref);
    }
    if (closures.length > 0) {
      // we hoist the closures onto the class, removing them from the render phase
      rootConfig.useClassComponent = true;
      // check if we already have a rootConfigEntry and entryKey, if not, create them
      if (rootConfigEntry === null && entryKey === null) {
        const entry = rootConfig.addEntry(propsValue, null, func);
        rootConfigEntry = entry.rootConfigEntry;
        entryKey = entry.entryKey;
      }
      closures.forEach(closure => {
        // get the name, or if its not there, make up a random one to avoid collisions
        const name =
          closure.__originalName ||
          (closure.properties.has("name") &&
            closure.properties.get("name").descriptor.value.value) ||
          Math.random().toString(36).replace(/[^a-z]+/g, "").substring(0, 2);
        if (rootConfigEntry.constructorProperties === null) {
          rootConfigEntry.constructorProperties = [];
        }
        rootConfigEntry.constructorProperties.push(
          t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(
                t.thisExpression(),
                t.identifier(entryKey + name)
              ),
              t.arrowFunctionExpression(
                closure.$FormalParameters,
                closure.$ECMAScriptCode
              )
            )
          )
        );
        // rename the reference to the function to the new name
        const newName = `this.${entryKey}${name}`;
        closure.__originalName = newName;
        if (closure.properties.has("name")) {
          closure.properties.get("name").descriptor.value.value = newName;
        }
      });
    }
  }
}

function renderOneLevel(
  componentType,
  props,
  moduleEnv,
  rootConfig,
  isBranched
) {
  if (isReactClassComponent(componentType)) {
    if (
      componentType.class !== undefined &&
      componentType.class.bailOut === true
    ) {
      throw new Error(componentType.class.bailOutReason);
    }
    // Class Component
    const { instance, commitWillMountPhase, commitDidMountPhase } = createReactClassInstance(
      componentType,
      props,
      moduleEnv,
      rootConfig,
      isBranched
    );

    const render = evaluator.get(instance, "render");
    const value = evaluator.call(render, instance, []);
    // we would have thrown if there was an issue, so if not, we can commit to root config
    commitWillMountPhase(value);
    return {value, commitDidMountPhase};
  } else {
    if (
      componentType.func !== undefined &&
      componentType.func.bailOut === true
    ) {
      throw new Error(`- ${componentType.func.bailOutReason}`);
    }
    // Stateless Functional Component
    // we sometimes get references to HOC wrappers, so lets check if this is a ref to a func
    if (componentType.$Call !== undefined) {
      const value = evaluator.call(componentType, undefined, [props]);
      findAndHoistClosures(value, props, null, null, rootConfig, componentType.func);
      return {value, commitDidMountPhase: null};
    }
  }
  return {value: null, commitDidMountPhase: null};
}

async function renderAsDeepAsPossible(
  componentType,
  props,
  moduleEnv,
  rootConfig,
  isBranched
) {
  const {value, commitDidMountPhase} = renderOneLevel(
    componentType,
    props,
    moduleEnv,
    rootConfig,
    isBranched
  );
  const result = await resolveDeeply(value, moduleEnv, rootConfig, isBranched);
  return {
    result,
    commitDidMountPhase,
  };
}

function getInlinedComponents() {
  return inlinedComponents;
}

exports.getInlinedComponents = getInlinedComponents;
exports.renderOneLevel = renderOneLevel;
exports.renderAsDeepAsPossible = renderAsDeepAsPossible;
