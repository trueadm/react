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

function A(props) {
  return 'Hello, ';
}

class B extends React.Component {
  render() {
    return 'world!';
  }
}

function App() {
  return [
    <A key="1" />,
    <B key="2" />,
  ];
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root />);
  yield ['render text', renderer.toJSON()];
};

module.exports = App;
