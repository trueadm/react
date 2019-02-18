/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const listenTo = [
  'onKeyPress',
  'onClick',
  'onPointerDown',
  'onPointerUp',
  'onPointerCancel',
];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  listenTo.push('onTouchStart', 'onTouchEnd', 'onTouchCancel', 'onMouseDown', 'onMouseUp');
}

const PressImpl = {
  listenTo,
  createInitialState(props) {
    return {};
  },
  processRichEvents(
    name,
    {listener, nativeEvent, targetElement, targetFiber, topLevelType},
    props,
    state,
    context,
  ): void {
    if (topLevelType === 'click' || topLevelType === 'keypress') {
      if (name === 'onPress') {
        let richEventListener = listener;

        if (topLevelType === 'keypress') {
          const isValidKeyPress =
            nativeEvent.which === 13 ||
            nativeEvent.which === 32 ||
            nativeEvent.keyCode === 13;

          if (!isValidKeyPress) {
            return;
          }
          // Wrap listener with prevent default behaviour
          richEventListener = e => {
            if (!e.isDefaultPrevented() && !e.nativeEvent.defaultPrevented) {
              e.preventDefault();
              listener(e);
            }
          };
        }
        const event = context.createRichEvent(
          'press',
          richEventListener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      }
    } else if (
      topLevelType === 'pointerdown' ||
      topLevelType === 'touchstart' ||
      topLevelType === 'mousedown'
    ) {
      if (name === 'onPressIn') {
        const event = context.createRichEvent(
          'pressin',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (name === 'onPressChange') {
        listener(true);
      }
    } else if (
      topLevelType === 'pointerup' ||
      topLevelType === 'pointercancel' ||
      topLevelType === 'touchend' ||
      topLevelType === 'touchcancel' ||
      topLevelType === 'mouseup'
    ) {
      if (name === 'onPressOut') {
        const event = context.createRichEvent(
          'pressup',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (name === 'onPressChange') {
        listener(false);
      }
    }
  },
};

export function onPress(props) {
  return {
    name: 'onPress',
    props,
    impl: PressImpl,
  };
}

export function onPressIn(props) {
  return {
    name: 'onPressIn',
    props,
    impl: PressImpl,
  };
}

export function onPressOut(props) {
  return {
    name: 'onPressOut',
    props,
    impl: PressImpl,
  };
}

export function onPressChange(props) {
  return {
    name: 'onPressChange',
    props,
    impl: PressImpl,
  };
}
