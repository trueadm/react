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
    return {
      isPressed: false,
    };
  },
  processRichEvents(
    context,
    config,
    state,
  ): void {
    const { eventTarget, eventTargetFiber, eventType, eventListener, nativeEvent, richEventType } = context;

    if (eventType === 'click' || eventType === 'keypress') {
      if (richEventType === 'onPress') {
        let richEventListener = eventListener;

        if (eventType === 'keypress') {
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
              eventListener(e);
            }
          };
        }
        const event = context.createRichEvent(
          'press',
          richEventListener,
          false,
          eventTarget,
          eventTargetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      }
    } else if (
      eventType === 'pointerdown' ||
      eventType === 'touchstart' ||
      eventType === 'mousedown'
    ) {
      if (richEventType === 'onPressIn') {
        const event = context.createRichEvent(
          'pressin',
          eventListener,
          false,
          eventTarget,
          eventTargetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (richEventType === 'onPressChange') {
        if (!state.isPressed) {
          eventListener(true);
        }
        state.isPressed = true;
      }
    } else if (
      eventType === 'pointerup' ||
      eventType === 'pointercancel' ||
      eventType === 'touchend' ||
      eventType === 'touchcancel' ||
      eventType === 'mouseup'
    ) {
      if (richEventType === 'onPressOut') {
        const event = context.createRichEvent(
          'pressup',
          eventListener,
          false,
          eventTarget,
          eventTargetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (richEventType === 'onPressChange') {
        if (state.isPressed) {
          eventListener(false);
        }
        state.isPressed = false;
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
