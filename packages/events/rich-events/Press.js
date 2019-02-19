/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = [
  'onKeyPress',
  'onPointerDown',
  'onPointerCancel',
];
const rootEventTypes =[
  'onPointerUp',
];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('onTouchStart', 'onMouseDown', 'onTouchCancel');
  rootEventTypes.push('onTouchEnd', 'onMouseUp');
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
  onChildEvent(
    context,
    props,
    state,
  ): void {
    const { eventTarget, eventTargetFiber, eventType, nativeEvent } = context;

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
      }
      case 'pointerdown':
      case 'touchstart':
      case 'mousedown': {
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
          if (!state.isPressed) {
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
        state.pressTarget = eventTarget;
        state.pressTargetFiber = eventTargetFiber;
        state.isPressed = true;
        context.addRootListeners(rootEventTypes);
      }
      case 'mouseup':
      case 'pointerup':
      case 'touchend':
      case 'touchcancel':
      case 'pointercancel': {
        if (state.isPressed) {
          state.isPressed = false;
          if (props.onPressOut) {
            context.dispatchTwoPhaseEvent(
              'pressout',
              props.onPressOut,
              nativeEvent,
              state.pressTarget,
              state.pressTargetFiber,
              false,
            );
          }
          if (props.onPressChange) {
            if (!state.isPressed) {
              const pressChangeEventListener = () => {
                props.onPressChange(false);
              };
              context.dispatchTwoPhaseEvent(
                'presschange',
                pressChangeEventListener,
                nativeEvent,
                state.pressTarget,
                state.pressTargetFiber,
                false,
              );
            }
          }
          if (state.pressTargetFiber !== null && props.onPress) {
            const target = e.target;
            let traverseFiber = context.getClosestInstanceFromNode(target);
            let triggerPress = false;
        
            while (traverseFiber !== null) {
              if (traverseFiber === state.pressTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              context.dispatchTwoPhaseEvent(
                'press',
                props.onPress,
                nativeEvent,
                state.pressTarget,
                state.pressTargetFiber,
                false,
              );
            }
          }
          state.pressTarget = null;
          state.pressStartFiber = null;
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