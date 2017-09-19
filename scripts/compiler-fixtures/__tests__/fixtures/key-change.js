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

class Stateful extends React.Component {
  constructor(props) {
    super(props);
    this.state = {updated: false};
  }
  componentWillReceiveProps() {
    this.setState({updated: true});
  }
  render() {
    return (
      <div>
        {this.props.children}
        (is update: {String(this.state.updated)})
      </div>
    );
  }
}

function App(props) {
  if (props.switch) {
    return (
      <div>
        <Stateful key='hi'>Hi</Stateful>
      </div>
    );
  }
  return (
    <div>
      <Stateful key='bye'>Bye</Stateful>
    </div>
  );
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root switch={false} />);
  yield ['mount', renderer.toJSON()];

  renderer.update(<Root switch={false} />);
  yield ['update with same key', renderer.toJSON()];

  renderer.update(<Root switch={true} />);
  yield ['update with different key', renderer.toJSON()];

  renderer.update(<Root switch={true} />);
  yield ['update with same key (again)', renderer.toJSON()];

  renderer.update(<Root switch={false} />);
  yield ['update with different key (again)', renderer.toJSON()];
};

module.exports = App;
