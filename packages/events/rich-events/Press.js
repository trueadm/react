/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = ['click', 'keydown', 'pointerdown', 'pointercancel'];
const rootEventTypes = ['pointerup', 'scroll'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup');
}

function dispatchPressEvent(context, name, state, listener) {
  const {nativeEvent} = context;
  context.dispatchTwoPhaseEvent(
    name,
    listener,
    nativeEvent,
    state.pressTarget,
    state.pressTargetFiber,
    false,
  );
}

function dispatchPressInEvents(context, props, state) {
  const {nativeEvent} = context;
  if (props.onPressIn) {
    context.dispatchTwoPhaseEvent(
      'pressin',
      props.onPressIn,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
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
      state.pressTarget,
      state.pressTargetFiber,
      false,
    );
  }
  if (!state.isLongPressed && (props.onLongPress || props.onLongPressChange)) {
    const longPressDelay = props.longPressDelay || 1000;
    state.longPressTimeout = setTimeout(() => {
      state.isLongPressed = true;
      state.longPressTimeout = null;
      if (props.onLongPressChange) {
        const longPressChangeEventListener = () => {
          props.onLongPressChange(true);
        };
        context.dispatchImmediateEvent(
          'longpresschange',
          longPressChangeEventListener,
          nativeEvent,
          state.pressTarget,
          state.pressTargetFiber,
        );
      }
    }, longPressDelay);
  }
}

function dispatchPressOutEvents(context, props, state) {
  const {nativeEvent} = context;
  if (state.longPressTimeout !== null) {
    clearTimeout(state.longPressTimeout);
    state.longPressTimeout = null;
  }
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
  if (props.onLongPressChange && state.isLongPressed) {
    const longPressChangeEventListener = () => {
      props.onLongPressChange(false);
    };
    context.dispatchTwoPhaseEvent(
      'longpresschange',
      longPressChangeEventListener,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
      false,
    );
  }
}

function isAnchorTagElement(eventTarget) {
  return eventTarget.nodeName === 'A';
}

const PressImplementation = {
  childEventTypes,
  rootEventTypes,
  createInitialState() {
    return {
      defaultPrevented: false,
      isAnchorTouched: false,
      isLongPressed: false,
      isPressed: false,
      longPressTimeout: null,
      pressTarget: null,
      pressTargetFiber: null,
    };
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
        dispatchPressEvent(context, 'press', state, keyPressEventListener);
        break;
      }
      case 'touchstart':
        // Touch events are for Safari, which lack pointer event support.
        if (!state.isPressed) {
          // We bail out of polyfilling anchor tags
          if (isAnchorTagElement(eventTarget)) {
            state.isAnchorTouched = true;
            return;
          }
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }

        break;
      case 'touchend': {
        // Touch events are for Safari, which lack pointer event support
        if (state.isAnchorTouched) {
          return;
        }
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          if (
            eventType !== 'touchcancel' &&
            (props.onPress || props.onLongPress)
          ) {
            // Find if the X/Y of the end touch is still that of the original target
            const changedTouch = nativeEvent.changedTouches[0];
            const target = eventTarget.ownerDocument.elementFromPoint(
              changedTouch.clientX,
              changedTouch.clientY,
            );
            if (target !== null) {
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
                if (state.isLongPressed && props.onLongPress) {
                  dispatchPressEvent(
                    context,
                    'longpress',
                    state,
                    props.onLongPress,
                  );
                } else if (props.onPress) {
                  dispatchPressEvent(context, 'press', state, props.onPress);
                }
              }
            }
          }
          state.isPressed = false;
          state.isLongPressed = false;
          // Prevent mouse events from firing
          nativeEvent.preventDefault();
          context.removeRootListeners(rootEventTypes);
        }
        break;
      }
      case 'pointerdown':
      case 'mousedown': {
        if (!state.isPressed) {
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }
        break;
      }
      case 'mouseup':
      case 'pointerup': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          if (
            state.pressTargetFiber !== null &&
            (props.onPress || props.onLongPress)
          ) {
            let traverseFiber = eventTargetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === state.pressTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              if (state.isLongPressed && props.onLongPress) {
                const longPressEventListener = e => {
                  props.onLongPress(e);
                  if (e.nativeEvent.defaultPrevented) {
                    state.defaultPrevented = true;
                  }
                };
                dispatchPressEvent(
                  context,
                  'longpress',
                  state,
                  longPressEventListener,
                );
              } else if (props.onPress) {
                const pressEventListener = e => {
                  props.onPress(e);
                  if (e.nativeEvent.defaultPrevented) {
                    state.defaultPrevented = true;
                  }
                };
                dispatchPressEvent(context, 'press', state, pressEventListener);
              }
            }
          }
          state.isPressed = false;
          state.isLongPressed = false;
          context.removeRootListeners(rootEventTypes);
        }
        state.isAnchorTouched = false;
        break;
      }
      case 'scroll':
      case 'touchcancel':
      case 'pointercancel': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          state.isLongPressed = false;
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
