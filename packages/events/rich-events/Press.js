/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = ['click', 'keydown', 'pointerdown', 'pointercancel'];
const rootEventTypes = ['pointerup'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup');
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

function dispatchPressInEvents(context, props, state) {
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
  if (props.onLongPress) {
    const longPressDelay = props.longPressDelay || 2000;
    state.longPressTimeout = setTimeout(() => {
      state.isPressed = false;
      state.isAnchorTouched = false;
      state.pressTarget = null;
      state.pressTargetFiber = null;
      state.longPressTimeout = null;
      if (props.onPressOut) {
        context.dispatchImmediateEvent(
          'pressout',
          props.onPressOut,
          nativeEvent,
          eventTarget,
          eventTargetFiber,
        );
      }
      if (props.onPressChange) {
        const pressChangeEventListener = () => {
          props.onPressChange(false);
        };
        context.dispatchImmediateEvent(
          'presschange',
          pressChangeEventListener,
          nativeEvent,
          eventTarget,
          eventTargetFiber,
        );
      }
      context.dispatchImmediateEvent(
        'longpress',
        props.onLongPress,
        nativeEvent,
        eventTarget,
        eventTargetFiber,
      );
    }, longPressDelay);
  }
}

function dispatchPressOutEvents(context, props, state) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (state.longPressTimeout !== null) {
    clearTimeout(state.longPressTimeout);
    state.longPressTimeout = null;
  }
  if (props.onPressOut) {
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
function isAnchorTagElement(eventTarget) {
  return eventTarget.nodeName === 'A';
}

const PressImplementation = {
  childEventTypes,
  createInitialState(props) {
    const state = {
      defaultPrevented: false,
      isAnchorTouched: false,
      isPressed: false,
      longPressTimeout: null,
      pressTarget: null,
      pressTargetFiber: null,
    };
    return state;
  },
  handleEvent(context, props, state): void {
    const {eventTarget, eventTargetFiber, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'keydown': {
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
        let keyPressEventListener = props.onPress;

        // Wrap listener with prevent default behaviour, unless
        // we are dealing with an anchor
        if (!isAnchorTagElement(eventTarget)) {
          keyPressEventListener = e => {
            if (!e.isDefaultPrevented() && !e.nativeEvent.defaultPrevented) {
              e.preventDefault();
              state.defaultPrevented = true;
              props.onPress(e);
            }
          };
        }
        dispatchPressEvent(context, keyPressEventListener);
        break;
      }
      case 'touchstart':
        // Touch events are for Safari, which lack pointer event support
        if (!state.isPressed) {
          // We bail out of polyfilling anchor tags
          if (isAnchorTagElement(eventTarget)) {
            state.isAnchorTouched = true;
            return;
          }
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
        }
        break;
      case 'touchcancel':
      case 'touchend': {
        // Touch events are for Safari, which lack pointer event support
        if (state.isAnchorTouched) {
          return;
        }
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          if (eventType !== 'touchcancel' && props.onPress) {
            // Find if the X/Y of the end touch is still that of the original target
            const changedTouch = nativeEvent.changedTouches[0];
            const target = eventTarget.ownerDocument.elementFromPoint(
              changedTouch.clientX,
              changedTouch.clientY,
            );
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
          dispatchPressInEvents(context, props, state);
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }
        break;
      }
      case 'mouseup':
      case 'pointerup': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          if (state.pressTargetFiber !== null && props.onPress) {
            let traverseFiber = eventTargetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === state.pressTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              const pressEventListener = e => {
                props.onPress(e);
                if (e.nativeEvent.defaultPrevented) {
                  state.defaultPrevented = true;
                }
              };
              dispatchPressEvent(context, pressEventListener);
            }
          }
          context.removeRootListeners(rootEventTypes);
        }
        state.isAnchorTouched = false;
        break;
      }
      case 'pointercancel': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
        }
        break;
      }
      case 'click': {
        if (state.defaultPrevented) {
          nativeEvent.preventDefault();
          state.defaultPrevented = false;
        }
      }
    }
  },
};

export default function pressEvents(props) {
  return {
    impl: PressImplementation,
    props,
  };
}
