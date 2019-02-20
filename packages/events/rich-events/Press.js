/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = ['onKeyPress', 'onPointerDown', 'onPointerCancel'];
const rootEventTypes = ['onPointerUp'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('onTouchStart', 'onTouchEnd', 'onMouseDown', 'onTouchCancel');
  rootEventTypes.push('onMouseUp');
}

function dispatchPressEvent(context, listener) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  context.dispatchTwoPhaseEvent(
    'press',
    listener,
    nativeEvent,
    eventTarget,
    eventTargetFiber,
    false,
  );
}

function dispatchPressInEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (props.onPressIn) {
    context.dispatchTwoPhaseEvent(
      'pressin',
      props.onPressIn,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
  if (props.onPressChange) {
    const pressChangeEventListener = () => {
      props.onPressChange(true);
    };
    context.dispatchTwoPhaseEvent(
      'presschange',
      pressChangeEventListener,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
}

function dispatchPressOutEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (props.onPressIn) {
    context.dispatchTwoPhaseEvent(
      'pressout',
      props.onPressOut,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
  if (props.onPressChange) {
    const pressChangeEventListener = () => {
      props.onPressChange(false);
    };
    context.dispatchTwoPhaseEvent(
      'presschange',
      pressChangeEventListener,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
}

const PressImplementation = {
  childEventTypes,
  createInitialState(props) {
    const state = {
      isPressed: false,
      pressTarget: null,
      pressTargetFiber: null,
    };
    return state;
  },
  onChildEvent(context, props, state): void {
    const {eventTarget, eventTargetFiber, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'keypress': {
        if (!props.onPress) {
          return;
        }
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
            props.onPress(e);
          }
        };
        dispatchPressEvent(context, keyPressEventListener);
        break;
      }
      case 'touchstart':
      // Touch events are for Safari, which lack pointer event support
        if (!state.isPressed) {
          dispatchPressInEvents(context, props);
          state.isPressed = true;
        }
        break;
      case 'touchcancel':
      case 'touchend': {
        // Touch events are for Safari, which lack pointer event support
        if (state.isPressed) {
          dispatchPressOutEvents(context, props);
          state.isPressed = false;
          if (eventType !== 'touchcancel' && props.onPress) {
            // Find if the X/Y of the end touch is still that of the original target
            const changedTouch = event.changedTouches[0];
            const target = eventTarget.ownerDocument.elementFromPoint(changedTouch.clientX, changedTouch.clientY);
            const targetFiber = context.getClosestInstanceFromNode(target);
            let traverseFiber = targetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === eventTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              dispatchPressEvent(context, props.onPress);
            }
          }
          // Prevent mouse events from firing
          nativeEvent.preventDefault();
        }
        break;
      }
      case 'pointerdown':
      case 'mousedown': {
        if (!state.isPressed) {
          dispatchPressInEvents(context, props);
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }
        break;
      }
      case 'mouseup':
      case 'pointerup':
      case 'pointercancel': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          if (eventType !== 'pointercancel' && state.pressTargetFiber !== null && props.onPress) {
            let traverseFiber = eventTargetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === state.pressTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              dispatchPressEvent(context, props.onPress);
            }
          }
          context.removeRootListeners(rootEventTypes);
        }
      }
    }
  },
};

export default function press(props) {
  return {
    impl: PressImplementation,
    props,
  };
}
