/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const {
  __object,
  __abstract,
} = require('./evaluator');
const reactClassMock = require('./mocks/reactClass');

function createMockReact(env, name) {
  const Component = env.eval(reactClassMock);
  Component.intrinsicName = `require('${name}').Component`;
  Component.properties.get('prototype').descriptor.value.intrinsicName = `require('${name}').Component.prototype`;

  const React = __abstract(__object({
    Component,
  }, `require('${name}')`), `require('${name}')`);

  return React;
}

module.exports = {
  createMockReact,
};
