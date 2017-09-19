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

class A extends React.Component {
  render() {
    return this.props.children;
  }
}

function App(props) {
  return (
    <A>
      <A>
        Hi
      </A>
    </A>
  );
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root />);
  yield ['simple children', renderer.toJSON()];
};

module.exports = App;
