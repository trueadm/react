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

async function resolveFragment(arrayValue) {
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
      elementProperty.descriptor.value = await resolveDeeply(elementValue);
    }
  }
}

async function resolveDeeply(value) {
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
      value.args[i] = await resolveDeeply(value.args[i]);
    }
    return value;
  }
  if (value instanceof ArrayValue) {
    await resolveFragment(value);
    return value;
  }
  if (isReactElement(value)) {
    let type = value.properties.get("type").descriptor.value;
    let props = value.properties.get("props").descriptor.value;
    if (type instanceof StringValue) {
      // Terminal host component. Start evaluating its children.
      let childrenProperty = props.properties.get("children");
      if (childrenProperty && childrenProperty.descriptor) {
        let resolvedChildren = await resolveDeeply(childrenProperty.descriptor.value);
        childrenProperty.descriptor.value = resolvedChildren;
      }
      return value;
    }
    try {
      return await renderAsDeepAsPossible(type, props);
    } catch (x) {
      // if (type.properties && type.properties.has('name')) {
      //   console.log(type.properties.get('name').descriptor.value.value)
      // } else if (type.func) {
      //   console.log(type.func.name);
      // }
      // console.log(x.stack + '\n')
      // If something went wrong, just bail out and return the value we had.
      return value;
    }
  }
  throw new Error("Unsupported return value from render or children.");
}

function renderOneLevel(componentType, props) {
  if (isReactClassComponent(componentType)) {
    // Class Component
    let inst = evaluator.construct(componentType, [props]);
    let render = evaluator.get(inst, "render");
    return evaluator.call(render, inst, []);
  } else {
    // Stateless Functional Component
    return evaluator.call(componentType, undefined, [props]);
  }
}

async function renderAsDeepAsPossible(componentType, props) {
  let result = renderOneLevel(componentType, props);
  return await resolveDeeply(result);
}

exports.renderOneLevel = renderOneLevel;
exports.renderAsDeepAsPossible = renderAsDeepAsPossible;
