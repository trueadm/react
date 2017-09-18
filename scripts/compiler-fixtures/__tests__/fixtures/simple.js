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
  return <div>Hello {props.x}</div>;
}

function B() {
  return <div>World</div>;
}

class C extends React.Component {
  render() {
    return <div>!</div>;
  }
}

function App() {
  return (
    <div>
      <A x={42} />
      <B />
      <C />
    </div>
  );
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root />);
  yield ['simple render', renderer.toJSON()];
};

module.exports = App;
