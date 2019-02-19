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
let Press;

describe('SyntheticEvent', () => {
  let container;

  beforeEach(() => {
    React = require('react');
    ReactDOM = require('react-dom');
    Press = require('react/events/press');

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  it('should support onPress', () => {
    const {onPress} = Press;
    let buttonRef = React.createRef();
    let events = [];

    function handleOnPress1() {
      events.push('press 1');
    }

    function handleOnPress2() {
      events.push('press 2');
    }

    function handleOnClick() {
      events.push('click');
    }

    function handleKeyPress() {
      events.push('keypress');
    }

    function Component() {
      return (
        <React.unstable_RichEvents listeners={[onPress(), handleOnPress1]}>
          <React.unstable_RichEvents listeners={[onPress(), handleOnPress2]}>
            <button ref={buttonRef} onClick={handleOnClick} onKeyPress={handleKeyPress}>
              Press me!
            </button>
          </React.unstable_RichEvents>
        </React.unstable_RichEvents>
      );
    }

    ReactDOM.render(<Component />, container);

    const clickEvent = document.createEvent('Event');
    clickEvent.initEvent('click', true, true);
    buttonRef.current.dispatchEvent(clickEvent);

    expect(events).toEqual(['click', 'press 2', 'press 1']);

    events = [];
    const keyPressEvent = new KeyboardEvent('keypress', {
      which: 13,
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    });
    buttonRef.current.dispatchEvent(keyPressEvent);

    // press 2 should not occur as press 1 will preventDefault
    expect(events).toEqual(['keypress', 'press 2']);
  });

  it('should support onPressIn and onPressOut', () => {
    const {onPressIn, onPressOut} = Press;
    let divRef = React.createRef();
    let events = [];

    function handleOnPressIn() {
      events.push('onPressIn');
    }

    function handleOnPressOut() {
      events.push('onPressOut');
    }

    function Component() {
      return (
        <React.unstable_RichEvents listeners={[onPressIn(), handleOnPressIn, onPressOut(), handleOnPressOut]}>
          <div ref={divRef}>
            Press me!
          </div>
        </React.unstable_RichEvents>
      );
    }

    ReactDOM.render(<Component />, container);

    const pointerEnterEvent = document.createEvent('Event');
    pointerEnterEvent.initEvent('pointerdown', true, true);
    divRef.current.dispatchEvent(pointerEnterEvent);

    const pointerLeaveEvent = document.createEvent('Event');
    pointerLeaveEvent.initEvent('pointerup', true, true);
    divRef.current.dispatchEvent(pointerLeaveEvent);

    expect(events).toEqual(['onPressIn', 'onPressOut']);
  });
});
