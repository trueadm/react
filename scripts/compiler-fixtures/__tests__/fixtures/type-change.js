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
        (is update: {this.state.updated})
      </div>
    );
  }
}

function MessagePane() {
  return <Stateful>Hi</Stateful>;
}

function SettingsPane() {
  return <Stateful>Bye</Stateful>;
}

function App(props) {
  if (props.switch) {
    return (
      <div>
        <MessagePane />
      </div>
    );
  }
  return (
    <div>
      <SettingsPane />
    </div>
  );
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root switch={false} />);
  yield ['mount', renderer.toJSON()];

  renderer.update(<Root switch={false} />);
  yield ['update with same type', renderer.toJSON()];

  renderer.update(<Root switch={true} />);
  yield ['update with different type', renderer.toJSON()];

  renderer.update(<Root switch={true} />);
  yield ['update with same type (again)', renderer.toJSON()];

  renderer.update(<Root switch={false} />);
  yield ['update with different type (again)', renderer.toJSON()];
};

module.exports = App;
