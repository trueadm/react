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
  UndefinedValue,
} = require('prepack/lib/values');
const {
  convertAccessorsToNestedObject,
  convertNestedObjectWithPrefixesToAst,
} = require('./types');
const t = require('babel-types');
const evaluator = require('./evaluator');

function isReactElement(value) {
  return value instanceof ObjectValue && value.properties.has('$$typeof');
}

function isReactClassComponent(type) {
  if (!(type instanceof FunctionValue)) {
    return false;
  }
  // Any ES6 class supported for now.
  return type.$FunctionKind === 'classConstructor';
}

async function resolveFragment(arrayValue, moduleEnv, rootConfig, isBranched) {
  let lengthProperty = arrayValue.properties.get('length');
  if (
    !lengthProperty ||
    !(lengthProperty.descriptor.value instanceof NumberValue)
  ) {
    throw new Error('Invalid length');
  }
  let length = lengthProperty.descriptor.value.value;
  for (let i = 0; i < length; i++) {
    let elementProperty = arrayValue.properties.get('' + i);
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
    const type = value.properties.get('type').descriptor.value;
    const props = value.properties.get('props').descriptor.value;
    const ref = value.properties.get('ref').descriptor.value;
    if (type instanceof StringValue) {
      // Terminal host component. Start evaluating its children.
      const childrenProperty = props.properties.get('children');
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
    if (type.properties && type.properties.has('name')) {
      name = type.properties.get('name').descriptor.value.value;
    } else if (type.func) {
      name = type.func.name;
    }
    if (!(ref instanceof NullValue)) {
      console.log(`\nFailed to inline component "${name}" has there was a ref on the ReactElement, this is not supported on components.\n`);
      return value;
    }
    try {
      const nextValue = await renderAsDeepAsPossible(
        type,
        props,
        moduleEnv,
        rootConfig,
        isBranched
      );
      if (nextValue === null) {
        console.log(
          `\nFailed to inline component "${type.intrinsicName}" as the reference wasn't a statically determinable function or class.\n`
        );
        return value;
      }
      return nextValue;
    } catch (x) {
      if (name !== undefined) {
        if (x.stack.indexOf('Failed to') === -1) {
          console.log(
            `\nFailed to inline component "${name}" due to a Prepack evaluation error:\n${x.stack}\n`
          );
        } else {
          console.log(
            `\nFailed to inline component "${name}" due to:\n${x.stack}\n`
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
  const {rootConfigEntry, entryKey} = rootConfig.addEntry(props, theClass);
  // we used to use Prepack to construct the component but this generally lead to
  // unwanted effects, as we don't really want to evaluate the code but rather
  // we just want to extract the things we care about and set everything else as abstract
  // specifically we want to create an object for "this" and put back on abstract properties
  // this will also help avoid bail outs and improve how we can inline things
  // we need to be careful not to set render methods to abstract (i.e. this._renderHeader())
  const baseComponent = moduleEnv.eval(
    t.memberExpression(t.identifier('React'), t.identifier('Component')),
    true
  );
  // add all prototype properties on to the BaseComponent
  const baseComponentPrototype = baseComponent.properties.get('prototype')
    .descriptor.value.properties;
  const componentPrototype = componentType.properties.get('prototype')
    .descriptor.value.properties;
  for (let [key, property] of componentPrototype) {
    if (key !== 'constructor') {
      baseComponentPrototype.set(key, property);
    }
  }
  const instance = evaluator.construct(baseComponent, [props]);
  const instanceProperties = instance.properties;
  // set props on the new instance
  instanceProperties.get('props').descriptor.value = props;
  // now we need to work out all the instance properties for "this"
  const thisObject = theClass.thisObject;
  const instanceThisShape = convertAccessorsToNestedObject(
    thisObject.accessors,
    null,
    true
  );
  const instanceThisAstWithPrefixes = convertNestedObjectWithPrefixesToAst(
    instanceThisShape,
    'this',
    entryKey,
    moduleEnv
  );
  let instanceThis = moduleEnv.eval(instanceThisAstWithPrefixes);
  // copy over the instanceThis properties to our instance, minus "props" as we have that already
  let useClassComponent = false;
  if (
    componentPrototype.has('componentWillMount') ||
    componentPrototype.has('componentDidMount') ||
    componentPrototype.has('componentWillUpdate') ||
    componentPrototype.has('componentDidUpdate') ||
    componentPrototype.has('componentWillUnmount') ||
    componentPrototype.has('componentDidCatch') ||
    componentPrototype.has('componentWillReceiveProps')
  ) {
    if (isBranched === true) {
      throw new Error(
        `Failed to inline component "${theClass.name}" due to the component having lifecycle events when inside a branch.`
      );
    }
    useClassComponent = true;
  }
  // TODO do we need to bail on sCU in branches too?
  if (componentPrototype.has('shouldComponentUpdate')) {
    useClassComponent = true;
  }
  for (let [key, value] of instanceThis.properties) {
    if (key === 'state') {
      useClassComponent = true;
      instanceProperties.set(key, value);
    } else if (key !== 'props') {
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
  const commitToRootConfig = () => {
    if (useClassComponent === true) {
      rootConfig.useClassComponent = true;
    }
    if (thisObject.properties.has('state')) {
      rootConfigEntry.state = thisObject.properties.get('state').astNode;
    }
    for (let [key, property] of componentPrototype) {
      if (key === 'constructor') {
        const constructorAstBody =
          property.descriptor.value.$ECMAScriptCode.body;
        rootConfigEntry.constructorProperties = constructorAstBody;
      } else if (key !== 'render') {
        if (theClass.methods.has(key)) {
          if (rootConfigEntry.prototypeProperties === null) {
            rootConfigEntry.prototypeProperties = [];
          }
          rootConfigEntry.prototypeProperties.push(
            theClass.methods.get(key).astNode
          );
        }
      }
    }
  };
  return {
    instance,
    commitToRootConfig,
  };
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
      throw new Error(
        `\nFailed to inline component "${componentType.class.name}" due to ${componentType.class.bailOutReason}.`
      );
    }
    // Class Component
    const {instance, commitToRootConfig} = createReactClassInstance(
      componentType,
      props,
      moduleEnv,
      rootConfig,
      isBranched
    );

    const render = evaluator.get(instance, 'render');
    const value = evaluator.call(render, instance, []);
    // we would have thrown if there was an issue, so if not, we can commit to root config
    commitToRootConfig();
    return value;
  } else {
    if (
      componentType.func !== undefined &&
      componentType.func.bailOut === true
    ) {
      throw new Error(
        `\nFailed to inline component "${componentType.func.name}" due to ${componentType.func.bailOutReason}.`
      );
    }
    if (componentType.func !== undefined && componentType.func.name === 'ReactBlueBarFlyout') {
      // debugger;
    }
    // Stateless Functional Component
    // we sometimes get references to HOC wrappers, so lets check if this is a ref to a func
    if (componentType.$Call !== undefined) {
      return evaluator.call(componentType, undefined, [props]);
    }
  }
  return null;
}

async function renderAsDeepAsPossible(
  componentType,
  props,
  moduleEnv,
  rootConfig,
  isBranched
) {
  const result = renderOneLevel(
    componentType,
    props,
    moduleEnv,
    rootConfig,
    isBranched
  );
  return await resolveDeeply(result, moduleEnv, rootConfig, isBranched);
}

exports.renderOneLevel = renderOneLevel;
exports.renderAsDeepAsPossible = renderAsDeepAsPossible;
