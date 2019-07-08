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
let ReactFeatureFlags;
let ReactDOM;
let Focus;

const createFocusEvent = type => {
  const event = document.createEvent('Event');
  event.initEvent(type, true, true);
  return event;
};

const createKeyboardEvent = (type, data) => {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...data,
  });
};

const createTabForward = type => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  return event;
};

const createTabBackward = type => {
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  return event;
};

const createPointerEvent = (type, data) => {
  const event = document.createEvent('CustomEvent');
  event.initCustomEvent(type, true, true);
  if (data != null) {
    Object.entries(data).forEach(([key, value]) => {
      event[key] = value;
    });
  }
  return event;
};

const modulesInit = () => {
  ReactFeatureFlags = require('shared/ReactFeatureFlags');
  ReactFeatureFlags.enableFlareAPI = true;
  React = require('react');
  ReactDOM = require('react-dom');
  Focus = require('react-events/focus').Focus;
};

describe('Focus event responder', () => {
  let container;

  beforeEach(() => {
    jest.resetModules();
    modulesInit();

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.render(null, container);
    document.body.removeChild(container);
    container = null;
  });

  describe('disabled', () => {
    let onBlur, onFocus, ref;

    beforeEach(() => {
      onBlur = jest.fn();
      onFocus = jest.fn();
      ref = React.createRef();
      const element = (
        <Focus disabled={true} onBlur={onBlur} onFocus={onFocus}>
          <div ref={ref} />
        </Focus>
      );
      ReactDOM.render(element, container);
    });

    it('prevents custom events being dispatched', () => {
      ref.current.dispatchEvent(createFocusEvent('focus'));
      ref.current.dispatchEvent(createFocusEvent('blur'));
      expect(onFocus).not.toBeCalled();
      expect(onBlur).not.toBeCalled();
    });
  });

  describe('onBlur', () => {
    let onBlur, ref;

    beforeEach(() => {
      onBlur = jest.fn();
      ref = React.createRef();
      const element = (
        <Focus onBlur={onBlur}>
          <div ref={ref} />
        </Focus>
      );
      ReactDOM.render(element, container);
    });

    it('is called after "blur" event', () => {
      ref.current.dispatchEvent(createFocusEvent('focus'));
      ref.current.dispatchEvent(createFocusEvent('blur'));
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('onFocus', () => {
    let onFocus, ref, innerRef;

    const componentInit = () => {
      onFocus = jest.fn();
      ref = React.createRef();
      innerRef = React.createRef();
      const element = (
        <Focus onFocus={onFocus}>
          <div ref={ref}>
            <a ref={innerRef} />
          </div>
        </Focus>
      );
      ReactDOM.render(element, container);
    };

    beforeEach(componentInit);

    it('is called after "focus" event', () => {
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(1);
    });

    it('is not called if descendants of target receive focus', () => {
      const target = innerRef.current;
      target.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).not.toBeCalled();
    });

    it('is called with the correct pointerType using pointer events', () => {
      // Pointer mouse
      ref.current.dispatchEvent(
        createPointerEvent('pointerdown', {
          pointerType: 'mouse',
        }),
      );
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({pointerType: 'mouse'}),
      );
      ref.current.dispatchEvent(createFocusEvent('blur'));

      // Pointer touch
      ref.current.dispatchEvent(
        createPointerEvent('pointerdown', {
          pointerType: 'touch',
        }),
      );
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(2);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({pointerType: 'touch'}),
      );
      ref.current.dispatchEvent(createFocusEvent('blur'));

      // Pointer pen
      ref.current.dispatchEvent(
        createPointerEvent('pointerdown', {
          pointerType: 'pen',
        }),
      );
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(3);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({pointerType: 'pen'}),
      );
    });

    it('is called with the correct pointerType without pointer events', () => {
      // Mouse
      ref.current.dispatchEvent(createPointerEvent('mousedown'));
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({pointerType: 'mouse'}),
      );
      ref.current.dispatchEvent(createFocusEvent('blur'));

      // Touch
      ref.current.dispatchEvent(createPointerEvent('touchstart'));
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(2);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({pointerType: 'touch'}),
      );
    });

    it('is called with the correct pointerType using a keyboard', () => {
      // Keyboard tab
      ref.current.dispatchEvent(
        createPointerEvent('keydown', {
          key: 'Tab',
        }),
      );
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({pointerType: 'keyboard'}),
      );
    });

    it('is called with the correct pointerType using Tab+altKey on Mac', () => {
      jest.resetModules();
      const platformGetter = jest.spyOn(global.navigator, 'platform', 'get');
      platformGetter.mockReturnValue('MacIntel');
      modulesInit();
      componentInit();

      ref.current.dispatchEvent(
        createPointerEvent('keydown', {
          key: 'Tab',
          altKey: true,
        }),
      );
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onFocus).toHaveBeenCalledWith(
        expect.objectContaining({
          pointerType: 'keyboard',
        }),
      );

      platformGetter.mockClear();
    });
  });

  describe('onFocusChange', () => {
    let onFocusChange, ref;

    beforeEach(() => {
      onFocusChange = jest.fn();
      ref = React.createRef();
      const element = (
        <Focus onFocusChange={onFocusChange}>
          <div ref={ref} />
        </Focus>
      );
      ReactDOM.render(element, container);
    });

    it('is called after "blur" and "focus" events', () => {
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocusChange).toHaveBeenCalledTimes(1);
      expect(onFocusChange).toHaveBeenCalledWith(true);
      ref.current.dispatchEvent(createFocusEvent('blur'));
      expect(onFocusChange).toHaveBeenCalledTimes(2);
      expect(onFocusChange).toHaveBeenCalledWith(false);
    });
  });

  describe('onFocusVisibleChange', () => {
    let onFocusVisibleChange, ref;

    beforeEach(() => {
      onFocusVisibleChange = jest.fn();
      ref = React.createRef();
      const element = (
        <Focus onFocusVisibleChange={onFocusVisibleChange}>
          <div ref={ref} />
        </Focus>
      );
      ReactDOM.render(element, container);
    });

    it('is called after "focus" and "blur" if keyboard navigation is active', () => {
      // use keyboard first
      container.dispatchEvent(createKeyboardEvent('keydown', {key: 'Tab'}));
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocusVisibleChange).toHaveBeenCalledTimes(1);
      expect(onFocusVisibleChange).toHaveBeenCalledWith(true);
      ref.current.dispatchEvent(createFocusEvent('blur'));
      expect(onFocusVisibleChange).toHaveBeenCalledTimes(2);
      expect(onFocusVisibleChange).toHaveBeenCalledWith(false);
    });

    it('is called if non-keyboard event is dispatched on target previously focused with keyboard', () => {
      // use keyboard first
      container.dispatchEvent(createKeyboardEvent('keydown', {key: 'Tab'}));
      ref.current.dispatchEvent(createFocusEvent('focus'));
      expect(onFocusVisibleChange).toHaveBeenCalledTimes(1);
      expect(onFocusVisibleChange).toHaveBeenCalledWith(true);
      // then use pointer on the target, focus should no longer be visible
      ref.current.dispatchEvent(createPointerEvent('pointerdown'));
      expect(onFocusVisibleChange).toHaveBeenCalledTimes(2);
      expect(onFocusVisibleChange).toHaveBeenCalledWith(false);
      // onFocusVisibleChange should not be called again
      ref.current.dispatchEvent(createFocusEvent('blur'));
      expect(onFocusVisibleChange).toHaveBeenCalledTimes(2);
    });

    it('is not called after "focus" and "blur" events without keyboard', () => {
      ref.current.dispatchEvent(createPointerEvent('pointerdown'));
      ref.current.dispatchEvent(createFocusEvent('focus'));
      container.dispatchEvent(createPointerEvent('pointerdown'));
      ref.current.dispatchEvent(createFocusEvent('blur'));
      expect(onFocusVisibleChange).toHaveBeenCalledTimes(0);
    });
  });

  describe('nested Focus components', () => {
    it('do not propagate events by default', () => {
      const events = [];
      const innerRef = React.createRef();
      const outerRef = React.createRef();
      const createEventHandler = msg => () => {
        events.push(msg);
      };

      const element = (
        <Focus
          onBlur={createEventHandler('outer: onBlur')}
          onFocus={createEventHandler('outer: onFocus')}
          onFocusChange={createEventHandler('outer: onFocusChange')}>
          <div ref={outerRef}>
            <Focus
              onBlur={createEventHandler('inner: onBlur')}
              onFocus={createEventHandler('inner: onFocus')}
              onFocusChange={createEventHandler('inner: onFocusChange')}>
              <div ref={innerRef} />
            </Focus>
          </div>
        </Focus>
      );

      ReactDOM.render(element, container);

      outerRef.current.dispatchEvent(createFocusEvent('focus'));
      outerRef.current.dispatchEvent(createFocusEvent('blur'));
      innerRef.current.dispatchEvent(createFocusEvent('focus'));
      innerRef.current.dispatchEvent(createFocusEvent('blur'));
      expect(events).toEqual([
        'outer: onFocus',
        'outer: onFocusChange',
        'outer: onBlur',
        'outer: onFocusChange',
        'inner: onFocus',
        'inner: onFocusChange',
        'inner: onBlur',
        'inner: onFocusChange',
      ]);
    });
  });

  it('expect displayName to show up for event component', () => {
    expect(Focus.responder.displayName).toBe('Focus');
  });

  it('should work as expected with autofocus', () => {
    const inputRef = React.createRef();
    const input2Ref = React.createRef();
    const buttonRef = React.createRef();
    const butto2nRef = React.createRef();
    const divRef = React.createRef();

    const SimpleFocusScope = () => (
      <div>
        <Focus autoFocus={true}>
          <input ref={inputRef} />
          <button ref={buttonRef} />
          <div ref={divRef} tabIndex={0} />
          <input ref={input2Ref} tabIndex={-1} />
          <button ref={butto2nRef} />
        </Focus>
      </div>
    );

    ReactDOM.render(<SimpleFocusScope />, container);
    expect(document.activeElement).toBe(inputRef.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(buttonRef.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(divRef.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(butto2nRef.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(divRef.current);
  });

  it('should work as expected when nested', () => {
    const inputRef = React.createRef();
    const input2Ref = React.createRef();
    const buttonRef = React.createRef();
    const button2Ref = React.createRef();
    const button3Ref = React.createRef();
    const button4Ref = React.createRef();

    const SimpleFocusScope = () => (
      <div>
        <Focus>
          <input ref={inputRef} tabIndex={-1} />
          <button ref={buttonRef} id={1} />
          <Focus>
            <button ref={button2Ref} id={2} />
            <button ref={button3Ref} id={3} />
          </Focus>
          <input ref={input2Ref} tabIndex={-1} />
          <button ref={button4Ref} id={4} />
        </Focus>
      </div>
    );

    ReactDOM.render(<SimpleFocusScope />, container);
    buttonRef.current.focus();
    expect(document.activeElement).toBe(buttonRef.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button2Ref.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button3Ref.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button4Ref.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(button3Ref.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(button2Ref.current);
  });

  it('should work as expected when nested with scope that is contained', () => {
    const inputRef = React.createRef();
    const input2Ref = React.createRef();
    const buttonRef = React.createRef();
    const button2Ref = React.createRef();
    const button3Ref = React.createRef();
    const button4Ref = React.createRef();

    const SimpleFocusScope = () => (
      <div>
        <Focus>
          <input ref={inputRef} tabIndex={-1} />
          <button ref={buttonRef} id={1} />
          <Focus contain={true}>
            <button ref={button2Ref} id={2} />
            <button ref={button3Ref} id={3} />
          </Focus>
          <input ref={input2Ref} tabIndex={-1} />
          <button ref={button4Ref} id={4} />
        </Focus>
      </div>
    );

    ReactDOM.render(<SimpleFocusScope />, container);
    buttonRef.current.focus();
    expect(document.activeElement).toBe(buttonRef.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button2Ref.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button3Ref.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button2Ref.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(button3Ref.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(button2Ref.current);
  });

  it('should work as expected with suspense fallbacks', () => {
    const buttonRef = React.createRef();
    const button2Ref = React.createRef();
    const button3Ref = React.createRef();
    const button4Ref = React.createRef();
    const button5Ref = React.createRef();

    function SuspendedComponent() {
      throw new Promise(() => {
        // Never resolve
      });
    }

    function Component() {
      return (
        <React.Fragment>
          <button ref={button5Ref} id={5} />
          <SuspendedComponent />
        </React.Fragment>
      );
    }

    const SimpleFocusScope = () => (
      <div>
        <Focus>
          <button ref={buttonRef} id={1} />
          <button ref={button2Ref} id={2} />
          <React.Suspense fallback={<button ref={button3Ref} id={3} />}>
            <Component />
          </React.Suspense>
          <button ref={button4Ref} id={4} />
        </Focus>
      </div>
    );

    ReactDOM.render(<SimpleFocusScope />, container);
    buttonRef.current.focus();
    expect(document.activeElement).toBe(buttonRef.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button2Ref.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button3Ref.current);
    document.activeElement.dispatchEvent(createTabForward());
    expect(document.activeElement).toBe(button4Ref.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(button3Ref.current);
    document.activeElement.dispatchEvent(createTabBackward());
    expect(document.activeElement).toBe(button2Ref.current);
  });
});
