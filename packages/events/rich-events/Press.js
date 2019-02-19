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
  'onPointerDown',
];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  listenTo.push('onTouchStart', 'onMouseDown');
}

function handlePressOut(state, context, e) {
  if (!state.isPressed) {
    return;
  }
  if (state.onPressChange !== null) {
    state.onPressChange();
  }
  if (state.onPressOut !== null) {
    state.onPressOut(e);
  }
  state.isPressed = false;
  if (e.type === "pointercancel" || e.type === "touchcancel") {
    state.pressStartFiber = null;
    return;
  }
  if (state.pressStartFiber !== null && state.onPress !== null) {
    const target= e.target;
    let traverseFiber = context.getClosestInstanceFromNode(target);
    let triggerPress = false;

    while (traverseFiber !== null) {
      if (traverseFiber === state.pressStartFiber) {
        triggerPress = true;
      }
      traverseFiber = traverseFiber.return;
    }
    if (triggerPress) {
      state.onPress(e);
    }
  }
  state.pressStartFiber = null;
}

const PressImplementation = {
  listenTo,
  createInitialState(config) {
    const state = {
      isPressed: false,
      onPress: null,
      onPressChange: null,
      onPressOut: null,
      pressStartFiber: null,
    };
    return state;
  },
  processRichEvents(
    context,
    props,
    state,
  ): void {
    const { eventTarget, eventTargetFiber, eventType, eventListener, nativeEvent, richEventType } = context;

    if (eventType === 'keypress') {
          const isValidKeyPress =
            nativeEvent.which === 13 ||
            nativeEvent.which === 32 ||
            nativeEvent.keyCode === 13;

          if (!isValidKeyPress) {
            return;
          }
          // Wrap listener with prevent default behaviour
          const keyPressEventListener = e => {
            if (!e.isDefaultPrevented() && !e.nativeEvent.defaultPrevented) {
              e.preventDefault();
              eventListener(e);
            }
          };
        context.dispatchTwoPhaseEvent(
          'press',
          keyPressEventListener,
          nativeEvent,
          eventTarget,
          eventTargetFiber,
          false,
        );
    } else if (
      eventType === 'pointerdown' ||
      eventType === 'touchstart' ||
      eventType === 'mousedown'
    ) {
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
      }
      if (!state.isPressed) {
        state.isPressed = true;
        state.pressStartFiber = eventTargetFiber;
        const pressUpEventListener = e => {
          document.removeEventListener('mouseup', pressUpEventListener);
          document.removeEventListener('pointerup', pressUpEventListener);
          document.removeEventListener('touchend', pressUpEventListener);
          document.removeEventListener('touchcancel', pressUpEventListener);
          handlePressOut(state, context, e);
        }
        document.addEventListener('mouseup', pressUpEventListener);
        document.addEventListener('pointerup', pressUpEventListener);
        document.addEventListener('touchend', pressUpEventListener);
        document.addEventListener('touchcancel', pressUpEventListener);
      }
    } else if (richEventType === 'onPressChange') {
      state.onPressChange = e => {
        if (state.isPressed) {
          eventListener(false);
        }
        state.onPressChange = null;
      };
    } else if (richEventType === 'onPressOut') {
      state.onPressOut = e => {
        if (state.isPressed) {
          eventListener(e);
        }
        state.onPressOut = null;
      };
    } else if (richEventType === 'onPress') {
      state.onPress = e => {
        eventListener(e);
        state.onPress = null;
      };
    }
  },
};

export default function press(props) {
  return {
    impl: PressImplementation,
    props,
  };
}