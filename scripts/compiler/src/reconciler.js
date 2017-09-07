let {
  AbstractValue,
  ArrayValue,
  BooleanValue,
  FunctionValue,
  ObjectValue,
  NumberValue,
  StringValue,
  SymbolValue,
  NullValue,
  UndefinedValue
} = require("prepack/lib/values");

let evaluator = require("./evaluator");

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

async function resolveFragment(arrayValue, rootConfig) {
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
      elementProperty.descriptor.value = await resolveDeeply(elementValue, rootConfig);
    }
  }
}

async function resolveDeeply(value, rootConfig) {
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
      value.args[i] = await resolveDeeply(value.args[i], rootConfig);
    }
    return value;
  }
  if (value instanceof ArrayValue) {
    await resolveFragment(value, rootConfig);
    return value;
  }
  if (isReactElement(value)) {
    const type = value.properties.get("type").descriptor.value;
    const props = value.properties.get("props").descriptor.value;
    if (type instanceof StringValue) {
      // Terminal host component. Start evaluating its children.
      const childrenProperty = props.properties.get("children");
      if (childrenProperty && childrenProperty.descriptor) {
        const resolvedChildren = await resolveDeeply(childrenProperty.descriptor.value, rootConfig);
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
    try {
      // TODO extra URI module
      if (name === 'Link') {
        // debugger;
      }
      return await renderAsDeepAsPossible(type, props, rootConfig);
    } catch (x) {
      if (name === 'Link') {
        console.log(x.stack + '\n')
        // debugger;
      }
      if (x.value !== undefined) {
        return await resolveDeeply(x.value, rootConfig);
      }
      // console.log(x.stack + '\n')
      // If something went wrong, just bail out and return the value we had.
      return value;
    }
  } else {
    return value;
  }
}

function renderOneLevel(componentType, props, rootConfig) {
  if (isReactClassComponent(componentType)) {
    // Class Component 
    // should we event construct the class? should we not pass in abstracts for
    // state and instance variables instead? otherwise it gets merged in our render
    // method, which isn't what we want
    const inst = evaluator.construct(componentType, [props]);
    if (componentType.class !== undefined) {
      const thisObject = componentType.class.thisObject;
      // check if the state is being used
      if (thisObject.accessors.has('state')) {
        // TODO:
        // we need to merge state and add prefixes on to avoid collisions
        const stateValue = inst.properties.get('state').descriptor.value;
        rootConfig.useClassComponent = true;
        if (rootConfig.state === null) {
          rootConfig.state = stateValue;
        } else {
          for (let [key, value] of stateValue.properties) {
            if (rootConfig.state.properties.has(key) === false) {
              rootConfig.state.properties.set(key, value);
            } else {
              debugger;
            }
          }
        }
        inst.properties.get('state').descriptor.value = evaluator.createAbstractObject('this.state');
      }
    }
    // set props on the instance
    inst.properties.get('props').descriptor.value = props;
    const render = evaluator.get(inst, "render");
    return evaluator.call(render, inst, []);
  } else {
    // Stateless Functional Component
    return evaluator.call(componentType, undefined, [props]);
  }
}

async function renderAsDeepAsPossible(componentType, props, rootConfig) {
  const result = renderOneLevel(componentType, props, rootConfig);
  return await resolveDeeply(result, rootConfig);
}

exports.renderOneLevel = renderOneLevel;
exports.renderAsDeepAsPossible = renderAsDeepAsPossible;
