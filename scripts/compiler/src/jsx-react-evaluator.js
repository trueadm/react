let { ConcreteValue, NumberValue, StringValue } = require("prepack/lib/values");
let {
  ArrayCreate,
  CreateDataPropertyOrThrow,
  GetValue,
  ObjectCreate,
  ResolveBinding,
  Set,
  ToString
} = require("prepack/lib/methods");

let reactElementSymbol = undefined;
let reactElementSymbolKey = "react.element";

let RESERVED_PROPS = {
  key: true,
  ref: true,
  __self: true,
  __source: true
};

function getReactElementSymbol(realm) {
  if (reactElementSymbol !== undefined) {
    return reactElementSymbol;
  }
  let SymbolFor = realm.intrinsics.Symbol.properties.get("for").descriptor
    .value;
  reactElementSymbol = SymbolFor.$Call(realm.intrinsics.Symbol, [
    new StringValue(realm, reactElementSymbolKey)
  ]);
  return reactElementSymbol;
}

function createReactElement(realm, type, key, ref, props) {
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  CreateDataPropertyOrThrow(
    realm,
    obj,
    "$$typeof",
    getReactElementSymbol(realm)
  );
  CreateDataPropertyOrThrow(realm, obj, "type", type);
  CreateDataPropertyOrThrow(realm, obj, "key", key);
  CreateDataPropertyOrThrow(realm, obj, "ref", ref);
  CreateDataPropertyOrThrow(realm, obj, "props", props);
  CreateDataPropertyOrThrow(realm, obj, "_owner", realm.intrinsics.null);
  return obj;
}

function createReactProps(realm, attributes, children) {
  // TODO: Deal with defaultProps here.
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  for (let [key, value] of attributes) {
    if (RESERVED_PROPS.hasOwnProperty(key)) {
      continue;
    }
    CreateDataPropertyOrThrow(realm, obj, key, value);
  }
  if (children !== null) {
    CreateDataPropertyOrThrow(realm, obj, "children", children);
  }
  return obj;
}

function evaluateJSXMemberExpression(ast, strictCode, env, realm) {
  switch (ast.type) {
    case "JSXIdentifier":
      return GetValue(realm, ResolveBinding(realm, ast.name, strictCode, env));
    case "JSXMemberExpression":
      return evaluateJSXMemberExpression(ast, strictCode, env, realm);
    default:
      throw new Error("Unknown JSX Identifier");
  }
}

function evaluateJSXIdentifier(ast, strictCode, env, realm) {
  let isTagName =
    ast.type === "JSXIdentifier" &&
    /^[a-z]|\-/.test(ast.name);
  if (isTagName) {
    // Special cased lower-case and custom elements
    return new StringValue(realm, ast.name);
  }
  return evaluateJSXMemberExpression(ast, strictCode, env, realm);
}

function evaluateJSXValue(value, strictCode, env, realm) {
  switch (value.type) {
    case "JSXText":
      return new StringValue(realm, value.value);
    case "StringLiteral":
      return new StringValue(realm, value.value);
    case "JSXExpressionContainer":
      return GetValue(realm, env.evaluate(value.expression, strictCode));
    case "JSXElement":
      return GetValue(realm, env.evaluate(value, strictCode));
    default:
      throw new Error("Unkonw JSX value type: " + value.type);
  }
}

function evaluateJSXAttributes(attributes, strictCode, env, realm) {
  let result = new Map();
  for (let attribute of attributes) {
    switch (attribute.type) {
      case "JSXAttribute":
        let { name, value } = attribute;
        if (name.type !== "JSXIdentifier") {
          throw new Error(
            "JSX attribute name type not supported: " + attribute.type
          );
        }
        result.set(name.name, evaluateJSXValue(value, strictCode, env, realm));
        break;
      case "JSXSpreadAttribute":
        throw new Error("spread attribute not yet implemented");
      default:
        throw new Error("Unknown JSX attribute type: " + attribute.type);
    }
  }
  return result;
}

function evaluateJSXChildren(children, strictCode, env, realm) {
  if (children.length === 0) {
    return null;
  }
  if (children.length === 1) {
    return evaluateJSXValue(children[0], strictCode, env, realm);
  }
  let array = ArrayCreate(realm, 0);
  for (let i = 0; i < children.length; i++) {
    let value = evaluateJSXValue(children[i], strictCode, env, realm);
    CreateDataPropertyOrThrow(realm, array, "" + i, value);
  }

  Set(realm, array, "length", new NumberValue(realm, children.length), false);

  return array;
}

module.exports = function(ast, strictCode, env, realm) {
  let openingElement = ast.openingElement;

  let type = evaluateJSXIdentifier(openingElement.name, strictCode, env, realm);
  let attributes = evaluateJSXAttributes(
    openingElement.attributes,
    strictCode,
    env,
    realm
  );
  let children = evaluateJSXChildren(ast.children, strictCode, env, realm);

  let key = attributes.get("key") || realm.intrinsics.null;
  let ref = attributes.get("ref") || realm.intrinsics.null;

  if (key === realm.intrinsics.undefined) {
    key = realm.intrinsics.null;
  }
  if (ref === realm.intrinsics.undefined) {
    ref = realm.intrinsics.null;
  }

  if (key !== realm.intrinsics.null && key instanceof ConcreteValue) {
    key = new StringValue(realm, ToString(realm, key));
  }

  let props = createReactProps(realm, attributes, children);

  return createReactElement(realm, type, key, ref, props);
};
