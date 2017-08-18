let construct_realm = require("prepack/lib/construct_realm").default;
let { ExecutionContext } = require("prepack/lib/realm");
let {
  NewDeclarativeEnvironment,
  GetValue,
  SetValue,
  Get,
  Set: $Set,
  ObjectCreate,
  Construct
} = require("prepack/lib/methods");
let { AbruptCompletion } = require("prepack/lib/completions");
let {
  ArrayValue,
  AbstractValue,
  ObjectValue,
  NumberValue,
  StringValue,
  FunctionValue
} = require("prepack/lib/values");
let { TypesDomain, ValuesDomain } = require("prepack/lib/domains");
let { Generator } = require("prepack/lib/utils/generator");
let buildExpressionTemplate = require("prepack/lib/utils/builder").default;
let jsxEvaluator = require("./jsx-react-evaluator");

class NoTempVariablesGenerator extends Generator {
  derive(types, values, args, buildNode, kind) {
    let result = this.realm.createAbstract(
      types,
      values,
      args,
      buildNode,
      kind
    );
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
  timeout: 5000,
  compatibility: "browser",
  errorHandler: onError,
};

let realm = construct_realm(realmOptions);
realm.generator = new NoTempVariablesGenerator(realm);
realm.evaluators.JSXElement = jsxEvaluator;

function createAbstractNumber(nameString) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let types = new TypesDomain(NumberValue);
  let values = ValuesDomain.topVal;
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  return result;
}

function createAbstractString(nameString) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let types = new TypesDomain(StringValue);
  let values = ValuesDomain.topVal;
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  return result;
}

function createAbstractArray(nameString) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let template = ObjectCreate(realm, realm.intrinsics.ArrayPrototype);
  let types = new TypesDomain(ArrayValue);
  let values = new ValuesDomain(new Set([template]));
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  template.makePartial();
  if (nameString) realm.rebuildNestedProperties(result, nameString);
  result.makeSimple();
  result.makePartial();
  return result;
}

function createObject(nameString, template) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let types = new TypesDomain(ObjectValue);
  let values = new ValuesDomain(new Set([template]));
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  return result;
}

function createAbstractObject(nameString) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let template = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  let types = new TypesDomain(ObjectValue);
  let values = new ValuesDomain(new Set([template]));
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  template.makePartial();
  if (nameString) realm.rebuildNestedProperties(result, nameString);
  result.makeSimple();
  result.makePartial();
  return result;
}

function createAbstractFunction(nameString) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let types = new TypesDomain(FunctionValue);
  let values = ValuesDomain.topVal;
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  return result;
}

function createAbstractUnknown(nameString) {
  let buildNode = buildExpressionTemplate(nameString)(realm.preludeGenerator);
  let types = new TypesDomain(AbstractValue);
  let values = ValuesDomain.topVal;
  let result = realm.createAbstract(
    types,
    values,
    [],
    buildNode,
    undefined,
    nameString
  );
  return result;
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
  context.realm = this.realm;
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
  return GetValue(this.realm, res);
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

function set(object, propertyName, value) {
  let context = new ExecutionContext();
  context.lexicalEnvironment = realm.$GlobalEnv;
  context.variableEnvironment = realm.$GlobalEnv;
  context.realm = realm;
  realm.pushContext(context);

  let res;
  try {
    res = $Set(realm, object, propertyName, value);
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
  return SetValue(realm, res);
}

exports.get = get;

exports.set = set;

exports.createAbstractArray = createAbstractArray;

exports.createAbstractNumber = createAbstractNumber;

exports.createAbstractString = createAbstractString;

exports.createAbstractObject = createAbstractObject;

exports.createAbstractFunction = createAbstractFunction;

exports.createAbstractUnknown = createAbstractUnknown;

exports.createObject = createObject;

exports.call = call;

exports.construct = construct;

exports.ModuleEnvironment = ModuleEnvironment;
