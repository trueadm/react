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

const emptyFunction = () => { };

const PressImpl = {
  listenTo,
  createInitialState(config) {
    return {
      isPressed: false,
      simulateClick: false,
      touchFiber: null,
    };
  },
  processRichEvents(
    context,
    config,
    state,
  ): void {
    const { eventTarget, eventTargetFiber, eventType, eventListener, nativeEvent, richEventType } = context;

    if (eventType === 'click' || eventType === 'keypress') {
      if (state.simulateClick) {
        state.simulateClick = false;
        return;
      }
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
        context.dispatchTwoPhaseEvent(
          'press',
          richEventListener,
          nativeEvent,
          eventTarget,
          eventTargetFiber,
          false,
        );
      }
    } else if (
      eventType === 'pointerdown' ||
      eventType === 'touchstart' ||
      eventType === 'mousedown'
    ) {
      if (eventType === 'touchstart' || eventType === 'pointerdown') {
        state.simulateClick = true;
        state.touchFiber = eventTargetFiber;
      }
      if (richEventType === 'onPressIn') {
        context.dispatchTwoPhaseEvent(
          'pressin',
          eventListener,
          nativeEvent,
          eventTarget,
          eventTargetFiber,
          false,
        );
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
        context.dispatchTwoPhaseEvent(
          'pressup',
          eventListener,
          nativeEvent,
          eventTarget,
          eventTargetFiber,
          false,
        );
      } else if (richEventType === 'onPressChange') {
        if (state.isPressed) {
          eventListener(false);
        }
        state.isPressed = false;
      }
      if (state.simulateClick && state.touchFiber !== null) {
        let traverseFiber = eventTargetFiber;
        let triggerPress = false;

        while (traverseFiber !== null) {
          if (traverseFiber === eventTargetFiber) {
            triggerPress = true;
          }
          traverseFiber = traverseFiber.return;
        }
        if (triggerPress) {
          context.dispatchTwoPhaseEvent(
            'press',
            eventListener,
            nativeEvent,
            eventTarget,
            eventTargetFiber,
            false,
          );
        }
        state.touchFiber = null;
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
