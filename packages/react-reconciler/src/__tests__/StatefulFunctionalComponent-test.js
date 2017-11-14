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

  const StatefulFunctionalReducerComponent = {
    initialState() {
      return {
        title: 'State!',
        counter: 0,
      };
    },
    reducer(action, state) {
      if (action === 'INCREMENT') {
        return {counter: state.counter + 1};
      }
    },
    willReceiveProps({reduce}) {
      reduce('INCREMENT');
    },
    render({props, state}) {
      return <div>{props.title}. {state.title} - counter: {state.counter}</div>;
    },
  };

  it('renders hello world div', () => {
    const mount = <StatefulFunctionalReducerComponent title="Hello world" />;
    const renderer = ReactTestRenderer.create(mount);
    expect(renderer.toJSON()).toMatchSnapshot();

    let update = <StatefulFunctionalReducerComponent title="Hello world #2" />;
    renderer.update(update);
    expect(renderer.toJSON()).toMatchSnapshot();

    update = <StatefulFunctionalReducerComponent title="Hello world #3" />;
    renderer.update(update);
    expect(renderer.toJSON()).toMatchSnapshot();
  });
});
