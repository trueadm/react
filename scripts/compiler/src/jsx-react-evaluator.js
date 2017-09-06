const { ConcreteValue, NumberValue, StringValue, UndefinedValue } = require("prepack/lib/values");
const {
  ArrayCreate,
  CreateDataPropertyOrThrow,
  GetValue,
  SetValue,
  ObjectCreate,
  ResolveBinding,
  Set,
  ToString
} = require("prepack/lib/methods");
const evaluator = require("./evaluator");
const traverser = require("./traverser");
const t = require("babel-types");
const convertAccessorsToNestedObject = require('./types').convertAccessorsToNestedObject;
const convertNestedObjectToAst = require('./types').convertNestedObjectToAst;

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

function createReactElementWithSpread(realm, type, spread) {
  let obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  CreateDataPropertyOrThrow(
    realm,
    obj,
    "$$typeof",
    getReactElementSymbol(realm)
  );
  CreateDataPropertyOrThrow(realm, obj, "type", type);
  CreateDataPropertyOrThrow(realm, obj, "props", spread);
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

function getDefaultProps(elementType, scope) {
  let defaultProps = null;
  if (scope !== null) {
    let componentData = scope.jsxElementIdentifiers.get(elementType.name);

    if (componentData !== undefined) {
      // the component is likely to be passed in as an argument
      if (componentData.type === 'FunctionCall') {
        // check if its a component
        if (componentData.args.length === 1) {
          if (componentData.args[0].defaultProps !== undefined) {
            componentData = componentData.args[0];
          } else {
            componentData = undefined;
          }
        } else {
          // TODO
          debugger;
        }
      } else if (componentData.defaultProps === undefined) {
        componentData = undefined;
      }
      if (componentData !== undefined) {
        if (componentData.defaultProps !== null) {
          defaultProps = componentData.defaultProps;
        }
      }
    } else {
      // for non component elements, like div and span, we need to find the parent function/class component
      // and then get its proptypes that way
      let currentScope = scope;
      while (currentScope !== null) {
        const func = currentScope.func;
        if (func != null) {
          if (func.defaultProps !== null) {
            defaultProps = func.defaultProps;
          } else if (func.theClass !== null) {
            if (func.theClass.defaultProps !== undefined) {
              defaultProps = func.theClass.defaultProps;
            }
            break;
          }
        }
        currentScope = currentScope.parentScope;
      }
    }
  }
  return defaultProps;
}

// because spread is so dynamic, there may be a property on the object that we're passing through
// that we don't know at this point, but can be inferred from what what is used inside the component
// that this JSXElement references
//
// For example:
//
// if we call <Foo {...props} />, where props is an abstract object
// and the contents of component Foo makes usage of {...props.something}, we can infer
// the spread props object contains a property called "something" that is also an abstract object
//
function addInferredSpreadProperties(spreadValue, spreadAstNode, elementType, scope) {
  if (scope !== null) {
    let componentData = scope.jsxElementIdentifiers.get(elementType.name);

    if (componentData !== undefined) {
      if (componentData.params !== undefined && componentData.params.length > 0) {
        const componentProps = componentData.params[0];

        for (let [key, value] of componentProps.accessors) {
          if (!spreadValue.properties.has(key)) {
            if (value.accessedAsSpread === true) {
              spreadValue.properties.set(key, {
                descriptor: {
                  value: evaluator.createAbstractObjectOrUndefined(),
                },
              });
            } else {
              spreadValue.properties.set(key, {
                descriptor: {
                  value: evaluator.createAbstractValue(),
                },
              });
            }
          }
        }
      }
    }
  }
}

function evaluateJSXAttributes(elementType, astAttributes, astChildren, strictCode, env, realm, scope) {
  let attributes = new Map();
  let children = evaluateJSXChildren(astChildren, strictCode, env, realm);
  let spread = null;
  const defaultProps = getDefaultProps(elementType, scope);
  // apply any defaultProps
  if (defaultProps !== null) {
    const defaultPropsShape = convertAccessorsToNestedObject(null, defaultProps.properties, true);
    const defaultPropsAst = convertNestedObjectToAst(defaultPropsShape);
    for (let i = 0; i < defaultPropsAst.properties.length; i++) {
      const defaultPropAst = defaultPropsAst.properties[i];
      const name = defaultPropAst.key.name;
      attributes.set(name, GetValue(realm, env.evaluate(defaultPropAst.value, strictCode)));
    }
  }
  for (let astAttribute of astAttributes) {
    switch (astAttribute.type) {
      case "JSXAttribute":
        let { name, value } = astAttribute;
        if (name.type !== "JSXIdentifier") {
          throw new Error(
            "JSX attribute name type not supported: " + astAttribute.type
          );
        }
        attributes.set(name.name, evaluateJSXValue(value, strictCode, env, realm));
        break;
      case "JSXSpreadAttribute":
        const possibleProperties = {};
        const spreadValue = GetValue(realm, env.evaluate(astAttribute.argument, strictCode));

        if (spreadValue.properties === undefined) {
          // we are passing in an object to spread where we know literally nothing about it...
          // we need to de-opt if this spread isn't the only property
          // otherwise, we make the attributes value the spread value
          if (astAttributes.length > 1) {
            throw new Error(`An unknown JSXSpreadAttribute of "...${traverser.getNameFromAst(astAttribute.argument)}" with unknown properties was passed in.`);
          }
          spread = spreadValue;
          // TODO do we set the children here too? probably...
          break;
        }
        addInferredSpreadProperties(spreadValue, astAttribute.argument, elementType, scope);
        // get the value from Prepack and see what properties Prepack already has information for
        for (let [key] of spreadValue.properties) {
          // we just assign it as any, as we derive the value as part of the generic flow below
          possibleProperties[key] = 'any';
        }
        Object.keys(possibleProperties).forEach(key => {
          const val = GetValue(realm, env.evaluate(t.memberExpression(astAttribute.argument, t.identifier(key)), strictCode));
          if (key === 'children') {
            if (!children) {
              children = val;
            }
          } else {
            attributes.set(key, val);
          }
        });
        break;
      default:
        throw new Error("Unknown JSX attribute type: " + astAttribute.type);
    }
  }
  // console.log(elementType.name)
  // debugger;
  return {
    attributes,
    children,
    spread,
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
  const {attributes, children, spread} = evaluateJSXAttributes(
    openingElement.name,
    openingElement.attributes,
    ast.children,
    strictCode,
    env,
    realm,
    scope
  );
  if (spread === null) {
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
    const props = createReactProps(realm, type, attributes, children, env);
    return createReactElement(realm, type, key, ref, props);
  } else {
    return createReactElementWithSpread(realm, type, spread);
  }
};
