const { ConcreteValue, NumberValue, StringValue, UndefinedValue } = require("prepack/lib/values");
const {
  ArrayCreate,
  CreateDataPropertyOrThrow,
  GetValue,
  ObjectCreate,
  ResolveBinding,
  Set,
  ToString
} = require("prepack/lib/methods");
const evaluator = require("./evaluator");
const traverser = require("./traverser");
const t = require("babel-types");
const convertAccessorsToNestedObject = require('./types').convertAccessorsToNestedObject;

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

function createReactProps(realm, type, attributes, children, env) {
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  for (let [key, value] of attributes) {
    if (RESERVED_PROPS.hasOwnProperty(key)) {
      continue;
    }
    CreateDataPropertyOrThrow(realm, obj, key, value);
  }
  // handle defaultProps
  let defaultProps = null;
  if (type.$FunctionKind === "classConstructor") {
    const classPrototype = type.properties.get("prototype").descriptor.value
      .properties;
    // check for a static property called defaultProps
    if (classPrototype.has("defaultProps")) {
      debugger;
    } else if (classPrototype.has("getDefaultProps")) {
      // check for a method called getDefaultProps
      const getDefaultPropsFunction = classPrototype.get("getDefaultProps").descriptor.value;
      defaultProps = GetValue(realm, evaluator.call(getDefaultPropsFunction));
    }
  } else if (type.$FunctionKind === "normal" && type.func !== undefined) {
    const functionProperties = type.func.properties.properties;

    if (functionProperties.has("defaultProps")) {
      const defaultPropertiesObject = functionProperties.get("defaultProps").astNode;

      if (defaultPropertiesObject !== undefined) {
        defaultProps = env.evaluate(defaultPropertiesObject);
      }
    }
  }
  if (defaultProps !== null) {
    for (let [key, value] of defaultProps.properties) {
      if (RESERVED_PROPS.hasOwnProperty(key) || attributes.has(key)) {
        continue;
      }
      CreateDataPropertyOrThrow(realm, obj, key, value.descriptor.value);
    }
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
  let isTagName = ast.type === "JSXIdentifier" && /^[a-z]|\-/.test(ast.name);
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

function evaluateJSXAttributes(elementType, astAttributes, astChildren, strictCode, env, realm, scope) {
  let attributes = new Map();
  let children = evaluateJSXChildren(astChildren, strictCode, env, realm);
  const attributeUsed = new Map();

  for (let astAttribute of astAttributes) {
    switch (astAttribute.type) {
      case "JSXAttribute":
        let { name, value } = astAttribute;
        if (name.type !== "JSXIdentifier") {
          throw new Error(
            "JSX attribute name type not supported: " + astAttribute.type
          );
        }
        attributeUsed.set(name.name, true);
        attributes.set(name.name, evaluateJSXValue(value, strictCode, env, realm));
        break;
      case "JSXSpreadAttribute":
        if (scope !== null) {
          const componentData = scope.jsxElementIdentifiers.get(elementType.name);
          let propTypes = null;

          if (componentData !== undefined && componentData.propTypes !== null) {
            propTypes = componentData.propTypes;
          } else {
            // for non component elements, like div and span, we need to find the parent function/class component
            // and then get its proptypes that way
            let currentScope = scope;
            while (currentScope !== null) {
              const func = currentScope.func;
              if (func !== undefined) {
                if (func.propTypes !== null) {
                  debugger;
                } else if (func.theClass !== null && func.theClass.propTypes !== undefined) {
                  propTypes = func.theClass.propTypes;
                  break;
                }
              }
              currentScope = currentScope.parentScope;
            }
          }
          const propsShape = Object.assign({
            // we auto-add "children" as it can be used implicility in React
            children: 'any',
          }, convertAccessorsToNestedObject(null, propTypes ? propTypes.properties : null) || {});
          const spreadName = traverser.getNameFromAst(astAttribute.argument);
          Object.keys(propsShape).forEach(key => {
            if (!attributeUsed.has(key)) {
              let val = null;
              try {
                val = GetValue(realm, env.evaluate(t.memberExpression(astAttribute.argument, t.identifier(key)), strictCode));

                if (val instanceof UndefinedValue) {
                  val = evaluator.createAbstractUnknown(`${spreadName}.${key}`);
                }
              } catch (e) {
                // TODO maybe look at how to improve this? it will spam all the abstracts properties from the spread on even if they may never be used :/
                val = evaluator.createAbstractUnknown(`${spreadName}.${key}`);
              }
              if (val !== null) {
                if (key === 'children') {
                  children = val;
                } else {
                  attributes.set(key, val);
                }
              }
            }
          });
          break;
        }
        throw new Error("spread attribute not yet implemented for this case (not enough data)");
      default:
        throw new Error("Unknown JSX attribute type: " + astAttribute.type);
    }
  }
  return {
    attributes,
    children,
  };
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
  const openingElement = ast.openingElement;
  const scope = ast.scope || null;
  const type = evaluateJSXIdentifier(openingElement.name, strictCode, env, realm);
  const {attributes, children} = evaluateJSXAttributes(
    openingElement.name,
    openingElement.attributes,
    ast.children,
    strictCode,
    env,
    realm,
    scope
  );

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

  let props = createReactProps(realm, type, attributes, children, env);

  return createReactElement(realm, type, key, ref, props);
};
