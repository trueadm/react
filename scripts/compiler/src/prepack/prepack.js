/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

const construct_realm = require("prepack/lib/construct_realm").default;
const { ExecutionContext } = require("prepack/lib/realm");
const {
  NewDeclarativeEnvironment,
  GetValue,
  Get,
  ObjectCreate,
  Construct,
  ToStringPartial
} = require("prepack/lib/methods");
const { AbruptCompletion } = require("prepack/lib/completions");
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
const { Generator } = require("prepack/lib/utils/generator");
const buildExpressionTemplate = require("prepack/lib/utils/builder").default;
const jsxEvaluator = require("./jsx");
const { describeLocation } = require("prepack/lib/intrinsics/ecma262/Error.js");
const initializePrepackGlobals = require("prepack/lib/intrinsics/prepack/global.js")
  .default;
const { NativeFunctionValue } = require("prepack/lib/values");

class NoTempVariablesGenerator extends Generator {
  derive(types, values, args, buildFunction, kind) {
    let result = AbstractValue.createFromTemplate(
      realm,
      _preludeGenerator => _args => {
        // convert it back to array
        args = Object.values_(args);
        return buildFunction(_args);
      },
      types,
      [],
      "",
      undefined
    );
    result.values = values;
    result.args = args;
    return result;
  }
}

function onError() {
  // Try to recover
  return "Recover";
}

let realmOptions = {
  residual: false,
  serialize: true,
  debugNames: false,
  uniqueSuffix: false,
  timeout: 8000,
  compatibility: "browser",
  errorHandler: onError
};

let realm = construct_realm(realmOptions);
realm.generator = new NoTempVariablesGenerator(realm);
realm.evaluators.JSXElement = jsxEvaluator;

function parseTypeNameOrTemplate(typeNameOrTemplate) {
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

function __object(shape, name) {
  const obj = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  Object.keys(shape).forEach(id => {
    obj.$Set(id, shape[id], obj);
  });
  if (name) {
    obj.intrinsicName = name;
  }
  return obj;
}

function __abstract(typeNameOrTemplate, name) {
  if (!realm.useAbstractInterpretation) {
    throw realm.createErrorThrowCompletion(
      realm.intrinsics.TypeError,
      "realm is not partial"
    );
  }

  let { type, template } = parseTypeNameOrTemplate(typeNameOrTemplate);

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
  throw realm.createErrorThrowCompletion(
    realm.intrinsics.TypeError,
    "not an (abstract) object"
  );
}

function __makeSimple(object) {
  // casting to any to avoid Flow bug
  if (object instanceof AbstractObjectValue || object instanceof ObjectValue) {
    object.makeSimple();
    return object;
  }
  throw realm.createErrorThrowCompletion(
    realm.intrinsics.TypeError,
    "not an (abstract) object"
  );
}

function createAbstractNumber(nameString) {
  return __abstract("number", nameString);
}

function createAbstractString(nameString) {
  return __abstract("string", nameString);
}

function createAbstractBoolean(nameString) {
  return __abstract("boolean", nameString);
}

function createAbstractArray(nameString) {
  return __makeSimple(
    __makePartial(
      __abstract(
        ObjectCreate(realm, realm.intrinsics.ArrayPrototype),
        nameString
      )
    )
  );
}

function createAbstractObject(nameString) {
  return __makeSimple(
    __makePartial(
      __abstract(
        ObjectCreate(realm, realm.intrinsics.ObjectPrototype),
        nameString
      )
    )
  );
}

function createAbstractRegExp(nameString) {
  return __makeSimple(
    __makePartial(
      __abstract(ObjectCreate(realm, realm.intrinsics.RegExp), nameString)
    )
  );
}

function createAbstractFunction(nameString) {
  return __makeSimple(__makePartial(__abstract("function", nameString)));
}

function createAbstractValue(nameString) {
  return __abstract("empty", nameString);
}

function getError(completionValue) {
  // Extract an execution error from the Prepack environment.
  let context = new ExecutionContext();
  realm.pushContext(context);
  try {
    let message = Get(realm, completionValue.value, "message").value;
    let stack = Get(realm, completionValue.value, "stack").value;
    let error = new Error("Error evaluating function");
    error.stack = message + "\n" + stack;
    return error;
  } finally {
    realm.popContext(context);
  }
}

class ModuleEnvironment {
  constructor() {
    this.lexicalEnvironment = NewDeclarativeEnvironment(
      realm,
      realm.$GlobalEnv
    );
  }

  declare(bindingName, value) {
    let envRecord = this.lexicalEnvironment.environmentRecord;
    envRecord.CreateImmutableBinding(bindingName, true);
    envRecord.InitializeBinding(bindingName, value);
  }

  eval(astNode) {
    let context = new ExecutionContext();
    context.lexicalEnvironment = this.lexicalEnvironment;
    context.variableEnvironment = this.lexicalEnvironment;
    context.realm = this.realm;
    realm.pushContext(context);

    let res;
    try {
      res = this.lexicalEnvironment.evaluateCompletion(astNode, false);
    } catch (completion) {
      if (completion instanceof AbruptCompletion) {
        res = completion;
      } else {
        throw completion;
      }
    } finally {
      realm.popContext(context);
    }
    if (res instanceof AbruptCompletion) {
      let error = getError(res);
      throw error;
    }
    return GetValue(this.realm, res);
  }
}

function call(
  functionValue,
  thisArg = realm.intrinsics.undefined,
  argsList = []
) {
  let context = new ExecutionContext();
  context.lexicalEnvironment = realm.$GlobalEnv;
  context.variableEnvironment = realm.$GlobalEnv;
  context.realm = realm;
  realm.pushContext(context);

  let res;
  try {
    res = functionValue.$Call(thisArg, argsList);
  } catch (completion) {
    if (completion instanceof AbruptCompletion) {
      res = completion;
    } else {
      throw completion;
    }
  } finally {
    realm.popContext(context);
  }
  if (res instanceof AbruptCompletion) {
    let error = getError(res);
    throw error;
  }
  return GetValue(realm, res);
}

function construct(constructor, argsList) {
  let context = new ExecutionContext();
  context.lexicalEnvironment = realm.$GlobalEnv;
  context.variableEnvironment = realm.$GlobalEnv;
  context.realm = realm;
  realm.pushContext(context);

  let res;
  try {
    res = Construct(realm, constructor, argsList);
  } catch (completion) {
    if (completion instanceof AbruptCompletion) {
      res = completion;
    } else {
      throw completion;
    }
  } finally {
    realm.popContext(context);
  }
  if (res instanceof AbruptCompletion) {
    let error = getError(res);
    throw error;
  }
  return GetValue(realm, res);
}

function get(object, propertyName) {
  let context = new ExecutionContext();
  context.lexicalEnvironment = realm.$GlobalEnv;
  context.variableEnvironment = realm.$GlobalEnv;
  context.realm = realm;
  realm.pushContext(context);

  let res;
  try {
    res = Get(realm, object, propertyName);
  } catch (completion) {
    if (completion instanceof AbruptCompletion) {
      res = completion;
    } else {
      throw completion;
    }
  } finally {
    realm.popContext(context);
  }
  if (res instanceof AbruptCompletion) {
    let error = getError(res);
    throw error;
  }
  return GetValue(realm, res);
}

function setGlobals(moduleEnv, mocks) {
  const global = realm.$GlobalObject;
  const { createMockReact } = mocks;
  initializePrepackGlobals(realm);

  const exportsValue = __object({});
  exportsValue.intrinsicName = 'exports';

  const moduleValue = __object({
    exports: exportsValue,
  });

  moduleValue.intrinsicName = 'module';
  global.$DefineOwnProperty("module", {
    value: moduleValue,
    writable: true,
    enumerable: false,
    configurable: true
  });
  global.$DefineOwnProperty("require", {
    value: new NativeFunctionValue(
      realm,
      "global.require",
      "require",
      0,
      (context, [requireObj]) => {
        const requireName = requireObj.value;

        switch (requireName) {
          case "react":
          case "React":
            return createMockReact(moduleEnv);
          default:
            return createAbstractValue(`require('${requireName}')`);
        }
      }
    ),
    writable: true,
    enumerable: false,
    configurable: true
  });
}

module.exports = {
  __abstract,
  __makePartial,
  __makeSimple,
  __object,
  get,
  createAbstractBoolean,
  createAbstractRegExp,
  createAbstractArray,
  createAbstractNumber,
  createAbstractString,
  createAbstractObject,
  createAbstractFunction,
  createAbstractValue,
  call,
  construct,
  ModuleEnvironment,
  realm,
  setGlobals
};
