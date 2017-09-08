const {
  AbstractValue,
  ArrayValue,
  FunctionValue,
  ObjectValue,
  NullValue,
  NumberValue,
  SymbolValue,
  UndefinedValue
} = require("prepack/lib/values");
const t = require("babel-types");
const travser = require("./traverser");

function getFunctionReferenceName(functionValue) {
  let name = null;
  if (functionValue.__originalName) {
    name = functionValue.__originalName;
  }
  const namer = functionValue.properties.get("name");
  if (namer && namer.descriptor.value.value) {
    name = namer.descriptor.value.value;
  }

  if (name !== null) {
    const hasThis = functionValue.$HomeObject !== undefined && functionValue.$HomeObject.properties.has(name);
    return `${hasThis ? 'this.' : ''}${name}`;
  }
  // debugger;
  return null;
}

function convertExpressionToJSXIdentifier(expr, rootConfig, source) {
  switch (expr.type) {
    case "Identifier":
      return t.jSXIdentifier(expr.name);
    case "StringLiteral":
      return t.jSXIdentifier(expr.value);
    case "MemberExpression":
      if (expr.computed) {
        throw new Error("Cannot inline computed expressions in JSX type.");
      }
      return t.jSXMemberExpression(
        convertExpressionToJSXIdentifier(expr.object),
        convertExpressionToJSXIdentifier(expr.property)
      );
    case "ArrowFunctionExpression":
      return expr;
    default:
      throw new Error("Invalid JSX Type: " + expr.type);
  }
}

function convertKeyValueToJSXAttribute(key, value, rootConfig, source) {
  let expr = convertValueToExpression(value, rootConfig, source);
  return t.jSXAttribute(
    t.jSXIdentifier(key),
    expr.type === "StringLiteral" ? expr : t.jSXExpressionContainer(expr)
  );
}

function addKeyToElement(astElement, key) {
  const astAttributes = astElement.openingElement.attributes;
  let existingKey = null;

  for (let i = 0; i < astAttributes.length; i++) {
    const astAttribute = astAttributes[i];
    
    if (astAttribute.type === 'JSXAttribute' && astAttribute.name.type === 'JSXIdentifier' && astAttribute.name.name === 'key') {
      existingKey = astAttribute.value;
    }
  }
  if (existingKey !== null) {
    // do nothing for now
  } else {
    astAttributes.push(t.jSXAttribute(t.jSXIdentifier('key'), t.stringLiteral(key)));
  }
}

// as we compile and inline components, nested arrays will be common
// to avoid key issues and bad updates, we need to manually add keys
// to static children that won't ever collide
function applyKeysToNestedArray(expr) {
  const astElements = expr.elements;
  const randomHashString = Math.random().toString(36).substring(5);

  for (let i = 0; i < astElements.length; i++) {
    const astElement = astElements[i];
    
    if (astElement.type === 'JSXElement') {
      addKeyToElement(astElement, `.${randomHashString}.${i}`);
    }
  }
}

function convertReactElementToJSXExpression(objectValue, rootConfig, source) {
  const objectProps = objectValue.properties;
  let typeValue = objectProps.get("type").descriptor.value;
  let keyValue = objectProps.has("key") ? objectProps.get("key").descriptor.value : null;
  let refValue = objectProps.has("ref") ? objectProps.get("ref").descriptor.value : null;
  let propsValue = objectProps.get("props").descriptor.value;

  let identifier = convertExpressionToJSXIdentifier(
    convertValueToExpression(typeValue, rootConfig, source), rootConfig, source
  );
  let attributes = [];
  let children = [];

  if (keyValue !== null && !(keyValue instanceof UndefinedValue || keyValue instanceof NullValue)) {
    attributes.push(convertKeyValueToJSXAttribute("key", keyValue, rootConfig, source));
  }

  if (refValue !== null && !(refValue instanceof UndefinedValue || refValue instanceof NullValue)) {
    attributes.push(convertKeyValueToJSXAttribute("ref", refValue, rootConfig, source));
  }
  if (propsValue.properties) {
    for (let [key, propertyBinding] of propsValue.properties) {
      let desc = propertyBinding.descriptor;
      if (desc === undefined) continue; // deleted

      if (key === "key" || key === "ref") {
        throw new Error(key + " is a reserved prop name");
      }

      if (key === "children") {
        let expr = convertValueToExpression(desc.value, rootConfig, source);
        let elements = expr.type === "ArrayExpression" && expr.elements.length > 1
          ? expr.elements
          : [expr];
        children = elements.map(
          expr => {
            if (expr.type === 'ArrayExpression') {
              applyKeysToNestedArray(expr);
            }
            return (expr === null
              ? t.jSXExpressionContainer(t.jSXEmptyExpression())
              : expr.type === "StringLiteral"
                  ? t.jSXText(expr.value)
                  : expr.type === "JSXElement"
                      ? expr
                      : t.jSXExpressionContainer(expr))
            }
        );
        continue;
      }
      attributes.push(convertKeyValueToJSXAttribute(key, desc.value, rootConfig, source));
    }
  } else {
    // spread
    attributes.push(t.jSXSpreadAttribute(convertValueToExpression(propsValue, rootConfig, source)));
  }

  if (identifier.type === 'ArrowFunctionExpression') {
    // we don't have the name here, so we have to find it
    // luckily I hacked it on to the BlockStatement body of the arrow function
    if (identifier.body.func !== undefined) {
      identifier = t.JSXIdentifier(identifier.body.func.name);
    } else if (identifier.params.func !== undefined) {
      // if its not there, I also hacked it onto the arguments
      identifier = t.JSXIdentifier(identifier.params.func.name);
    } else {
      // we need to do more hacking?
      debugger;

    }
  }

  let openingElement = t.jSXOpeningElement(
    identifier,
    attributes,
    children.length === 0
  );
  let closingElement = t.jSXClosingElement(identifier);

  return t.jSXElement(
    openingElement,
    closingElement,
    children,
    children.length === 0
  );
}

function convertObjectValueToObjectLiteral(objectValue, rootConfig, source) {
  let properties = [];
  for (let [key, propertyBinding] of objectValue.properties) {
    let desc = propertyBinding.descriptor;
    if (desc === undefined) continue; // deleted
    let expr = convertValueToExpression(desc.value, rootConfig, source);
    let property = t.objectProperty(t.stringLiteral(key), expr, false);
    properties.push(property);
  }
  return t.objectExpression(properties);
}

function convertArrayValueToArrayLiteral(arrayValue, rootConfig, source) {
  let lengthProperty = arrayValue.properties.get("length");
  if (
    !lengthProperty ||
    !(lengthProperty.descriptor.value instanceof NumberValue)
  ) {
    throw new Error("Invalid length");
  }
  let length = lengthProperty.descriptor.value.value;
  let elements = [];
  for (let i = 0; i < length; i++) {
    let elementProperty = arrayValue.properties.get("" + i);
    let elementValue =
      elementProperty &&
      elementProperty.descriptor &&
      elementProperty.descriptor.value;
    elements.push(elementValue ? convertValueToExpression(elementValue, rootConfig, source) : null);
  }
  return t.arrayExpression(elements);
}

const isInvalid = {
  '{': true,
  '}': true,
  ' ': true,
  '+': true,
  '-': true,
  '|': true,
  '&': true,
  // ',': true,
  ';': true,
  '\n': true,
  ')': true,
  '(': true,
  ':': true,
  '=': true,
};


// TODO this entire thing is as hacky as anything and needs to go away
function getExpressionFromSource(start, end, source) {
  const lines = source.split('\n');
  let inString = false;
  if (start.line === end.line) {
    const line = lines[start.line - 1];
    let i = start.column;
    let char = line[i];
    let string = '';
    while (char && (!isInvalid[char] || inString === true)) {
      if (char === "'") {
        if (inString === true) {
          inString = false;
        } else {
          inString = true;
        }
      }
      string += char;
      i++;
      char = line[i];
    }
    if (string[0] === "'" && string[string.length - 1] === "'" && string !== "''") {
      // we are passing a string into a function call (hacky as hell)
      // lets traverve back from start to find the call
      let s = start.column - 2;
      char = line[s];
      while (char && (!isInvalid[char] || char === '(')) {
        s--;
        char = line[s];
      }
      string = line.substring(s + 1, i + 1);
    }
    return string;
  } else {
    debugger;
  }
}

function convertValueToExpression(value, rootConfig, source) {
  if (value instanceof AbstractValue) {
    let serializedArgs = value.args.map(abstractArg => 
      convertValueToExpression(abstractArg, rootConfig, source)
    );
    if (value.isIntrinsic()) {
      if (value.intrinsicName.indexOf('_$') !== -1) {
        const nameFromSource = getExpressionFromSource(value.expressionLocation.start, value.expressionLocation.end, source);
        value._buildNode.name = nameFromSource;
        value.intrinsicName = nameFromSource;
      }
      if (rootConfig.useClassComponent === false && value.intrinsicName.indexOf('this.props') !== -1) {
        // hack for now
        const node = value.buildNode(serializedArgs);
        node.object = t.identifier('props');
        return node;
      }
    } else if (serializedArgs.length === 0) {
      return t.identifier(getExpressionFromSource(value.expressionLocation.start, value.expressionLocation.end, source));
    }
    return value.buildNode(serializedArgs);
  }
  if (value.isIntrinsic()) {
    return t.identifier(value.intrinsicName);
  }
  if (value instanceof FunctionValue) {
    // TODO: Get a proper reference from a lexical map of names instead.
    let name = getFunctionReferenceName(value);
    if (name !== null) {
      if (name.indexOf('bound') !== -1) {
        // this is a temp hack
        name = name.replace('bound ', '');
      }
      return t.identifier(name);
    } else {
      // TODO: assume an arrow function for now?
      return t.arrowFunctionExpression(
        value.$FormalParameters,
        value.$ECMAScriptCode
      );
    }
  }
  if (value instanceof ObjectValue) {
    if (value.properties.has("$$typeof")) {
      // TODO: Also compare the value to ensure it's the symbol
      return convertReactElementToJSXExpression(value, rootConfig, source);
    }
    if (value instanceof ArrayValue) {
      return convertArrayValueToArrayLiteral(value, rootConfig, source);
    }
    // TODO: Handle all the object special cases.
    return convertObjectValueToObjectLiteral(value, rootConfig, source);
  }
  if (value instanceof SymbolValue) {
    return t.nullLiteral();
  }
  return t.valueToNode(value.serialize());
}

function serializeEvaluatedFunction(functionValue, args, evaluatedReturnValue, rootConfig, source) {
  const name = getFunctionReferenceName(functionValue);
  const params = args.map(arg => {
    const intrinsicName = arg.intrinsicName;
    if (!intrinsicName) {
      throw new Error("Expected arguments to have an intrinsic name");
    }
    return t.identifier(intrinsicName);
  });
  const bodyExpr = convertValueToExpression(evaluatedReturnValue, rootConfig, source);
  const returnStatement = t.returnStatement(bodyExpr);
  const renderBody = t.blockStatement([returnStatement]);
  if (rootConfig.useClassComponent === true) {
    return t.classDeclaration(
      t.identifier(name), t.memberExpression(t.identifier('React'), t.identifier('Component')),
      t.classBody([
        // build the constructor method and put the merged state object back in
        // TODO: add in merged instance variables and other stuff
        t.classMethod('constructor', t.identifier('constructor'), [t.identifier('props')], t.blockStatement([
          t.expressionStatement(t.callExpression(t.identifier('super'), [t.identifier('props')])),
          t.expressionStatement(t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('state')),
            convertValueToExpression(rootConfig.state, rootConfig, source),
          )),
        ])),
        // put in the optimized render method
        t.classMethod('method', t.identifier('render'), [], renderBody),
      ]),
      []
    );
  }
  return t.functionDeclaration(t.identifier(name), params, renderBody);
}

exports.convertValueToExpression = convertValueToExpression;

exports.serializeEvaluatedFunction = serializeEvaluatedFunction;
