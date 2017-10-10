/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

const { NativeFunctionValue } = require("prepack/lib/values");
const { __abstract, __object } = require("./helpers");
const reactClassMock = require("./mocks/reactClass");

function createMockReact(env, name) {
  const Component = env.eval(reactClassMock);
  Component.intrinsicName = `require('${name}').Component`;
  Component.properties.get(
    "prototype"
  ).descriptor.value.intrinsicName = `require('${name}').Component.prototype`;

  const React = __abstract(
    __object(
      {
        Component
      },
      `require('${name}')`
    ),
    `require('${name}')`
  );

  return React;
}

function initializeGlobals(realm) {
  const global = realm.$GlobalObject;
  const exportsValue = __object(realm, {});
  exportsValue.intrinsicName = "exports";

  const moduleValue = __object(realm, {
    exports: exportsValue
  });

  moduleValue.intrinsicName = "module";
  global.$DefineOwnProperty("module", {
    value: moduleValue,
    writable: true,
    enumerable: false,
    configurable: true
  });
  global.$DefineOwnProperty("__constructReactComponent", {
    value: new NativeFunctionValue(
      realm,
      "global.__constructReactComponent",
      "__constructReactComponent",
      0,
      (context, [componentName, value]) => {
        // return optimizeComponent(componentName.value, value);
      }
    ),
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
          // return createMockReact(moduleEnv, requireName);
          default:
            return __abstract(realm, "empty", `require('${requireName}')`);
        }
      }
    ),
    writable: true,
    enumerable: false,
    configurable: true
  });
}

module.exports = {
  initializeGlobals
};
