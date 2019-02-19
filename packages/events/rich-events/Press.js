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
  createInitialState(config) {
    return {};
  },
  processRichEvents(
    {type, listener, nativeEvent, targetElement, targetFiber, topLevelType},
    config,
    context,
  ): void {
    if (topLevelType === 'click' || topLevelType === 'keypress') {
      if (type === 'onPress') {
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
      if (type === 'onPressIn') {
        const event = context.createRichEvent(
          'pressin',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (type === 'onPressChange') {
        listener(true);
      }
    } else if (
      topLevelType === 'pointerup' ||
      topLevelType === 'pointercancel' ||
      topLevelType === 'touchend' ||
      topLevelType === 'touchcancel' ||
      topLevelType === 'mouseup'
    ) {
      if (type === 'onPressOut') {
        const event = context.createRichEvent(
          'pressup',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (type === 'onPressChange') {
        listener(false);
      }
    }
  },
};

export function onPress(config) {
  return {
    type: 'onPress',
    config,
    impl: PressImpl,
  };
}

onPress.type = 'onPress';
onPress.config = null;
onPress.impl = PressImpl;

export function onPressIn(config) {
  return {
    type: 'onPressIn',
    config,
    impl: PressImpl,
  };
}

onPressIn.type = 'onPressIn';
onPressIn.config = null;
onPressIn.impl = PressImpl;

export function onPressOut(config) {
  return {
    type: 'onPressOut',
    config,
    impl: PressImpl,
  };
}

onPressOut.type = 'onPressOut';
onPressOut.config = null;
onPressOut.impl = PressImpl;

export function onPressChange(config) {
  return {
    type: 'onPressChange',
    config,
    impl: PressImpl,
  };
}

onPressChange.type = 'onPressChange';
onPressChange.config = null;
onPressChange.impl = PressImpl;
