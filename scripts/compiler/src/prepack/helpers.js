"use strict";

const {
  ObjectCreate,
  ToStringPartial
} = require("prepack/lib/methods");
const {
  AbstractObjectValue,
  AbstractValue,
  ObjectValue,
  StringValue,
  FunctionValue,
  UndefinedValue,
  Value
} = require("prepack/lib/values");
const { ValuesDomain } = require("prepack/lib/domains");
const buildExpressionTemplate = require("prepack/lib/utils/builder").default;
const { describeLocation } = require("prepack/lib/intrinsics/ecma262/Error.js");

function parseTypeNameOrTemplate(realm, typeNameOrTemplate) {
  if (
    typeNameOrTemplate === undefined ||
    typeNameOrTemplate instanceof UndefinedValue
  ) {
    return { type: Value, template: undefined };
  } else if (
    typeNameOrTemplate instanceof StringValue ||
    typeof typeNameOrTemplate === "string"
  ) {
    let typeNameString = ToStringPartial(realm, typeNameOrTemplate);
    let type = Value.getTypeFromName(typeNameString);
    if (type === undefined) {
      throw realm.createErrorThrowCompletion(
        realm.intrinsics.TypeError,
        "unknown typeNameOrTemplate"
      );
    }
    return {
      type,
      template: Value.isTypeCompatibleWith(type, ObjectValue)
        ? ObjectCreate(realm, realm.intrinsics.ObjectPrototype)
        : undefined
    };
  } else if (typeNameOrTemplate instanceof FunctionValue) {
    return { type: FunctionValue, template: typeNameOrTemplate };
  } else if (typeNameOrTemplate instanceof ObjectValue) {
    return { type: ObjectValue, template: typeNameOrTemplate };
  } else {
    throw realm.createErrorThrowCompletion(
      realm.intrinsics.TypeError,
      "typeNameOrTemplate has unsupported type"
    );
  }
}

function __object(realm, shape, name) {
  const obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  Object.keys(shape).forEach(id => {
    obj.$Set(id, shape[id], obj);
    if (name) {
      shape[id].intrinsicName = `${name}.${id}`;
    }
  });
  if (name) {
    obj.intrinsicName = name;
  }
  return obj;
}

function __abstract(realm, typeNameOrTemplate, name) {
  if (!realm.useAbstractInterpretation) {
    throw realm.createErrorThrowCompletion(
      realm.intrinsics.TypeError,
      "realm is not partial"
    );
  }

  let { type, template } = parseTypeNameOrTemplate(realm, typeNameOrTemplate);

  let result;
  let nameString = name ? ToStringPartial(realm, name) : "";
  if (nameString === "") {
    let locString;
    for (let executionContext of realm.contextStack.slice().reverse()) {
      let caller = executionContext.caller;
      locString = describeLocation(
        realm,
        caller ? caller.function : undefined,
        caller ? caller.lexicalEnvironment : undefined,
        executionContext.loc
      );
      if (locString !== undefined) break;
    }
    debugger;
    // result = AbstractValue.createFromTemplate(realm, throwTemplate, type, [locVal], throwTemplateSrc);
  } else {
    result = AbstractValue.createFromTemplate(
      realm,
      buildExpressionTemplate(nameString),
      type,
      [],
      nameString
    );
    result.intrinsicName = nameString;
  }

  if (template) result.values = new ValuesDomain(new Set([template]));
  if (template && !(template instanceof FunctionValue)) {
    // why exclude functions?
    template.makePartial();
    // invariant(realm.generator);
    if (nameString) realm.rebuildNestedProperties(result, nameString);
  }
  return result;
}

function __makePartial(object) {
  // casting to any to avoid Flow bug
  if (object instanceof AbstractObjectValue || object instanceof ObjectValue) {
    object.makePartial();
    return object;
  }
}

function __makeSimple(object) {
  // casting to any to avoid Flow bug
  if (object instanceof AbstractObjectValue || object instanceof ObjectValue) {
    object.makeSimple();
    return object;
  }
}

module.exports = {
  __object,
  __abstract,
  __makeSimple,
  __makePartial,
};
