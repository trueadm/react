/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

var React;
var ReactNoop;

describe.only('Stateful Functional Components', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactNoop = require('react-noop-renderer');
  });

  const StatefulFunctionalComponent = {
    render(props) {
      return <div>{props.title}</div>;
    }
  }

  it('renders hello world div', () => {
    ReactNoop.render(<StatefulFunctionalComponent title="Hello world" />);
    ReactNoop.flush();
    expect(ReactNoop.getChildren()).toEqual([{text: '10'}]);
  });
});
