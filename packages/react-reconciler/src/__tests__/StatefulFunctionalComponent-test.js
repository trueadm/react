/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

let React;
let ReactTestRenderer;

describe.only('Stateful Functional Components', () => {
  beforeEach(() => {
    jest.resetModules();
    React = require('react');
    ReactTestRenderer = require('react-test-renderer');
  });

  const StatefulFunctionalComponent = {
    initialState() {
      return {
        title: 'State!',
      };
    },
    render(props, state) {
      return <div>{props.title}. {state.title}</div>;
    },
  };

  it('renders hello world div', () => {
    const input = <StatefulFunctionalComponent title="Hello world" />;
    const tree = ReactTestRenderer.create(input).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
