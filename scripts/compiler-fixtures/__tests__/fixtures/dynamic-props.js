/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var React = require('react');

function Fn(props) {
  return <div>Hello {props[props.dynamicKey]}</div>;
}

function App(props) {
  return <Fn foo="World" dynamicKey={props.dynamicKey} />;
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root dynamicKey="foo" />);
  yield ['render with dynamic prop access', renderer.toJSON()];
};

module.exports = App;
