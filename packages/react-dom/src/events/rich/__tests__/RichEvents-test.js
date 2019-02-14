/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 */

'use strict';

let React;
let ReactDOM;
let onPress;

describe('SyntheticEvent', () => {
  let container;

  beforeEach(() => {
    React = require('react');
    ReactDOM = require('react-dom');
    onPress = require('react-dom/events/press').onPress;

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('should support onPress', () => {
    let buttonRef = React.createRef();
    let didPress = false;

    function handleOnPress() {
      didPress = true;
    }

    function Component() {
      return (
        <React.unstable_RichEvents listeners={[onPress, handleOnPress]}>
          <button ref={buttonRef}>
            Press me!
          </button>
        </React.unstable_RichEvents>
      );
    }

    ReactDOM.render(<Component />, container);

    const event = document.createEvent('Event');
    event.initEvent('click', true, true);
    buttonRef.current.dispatchEvent(event);

    expect(didPress).toBe(true);
  });
});
