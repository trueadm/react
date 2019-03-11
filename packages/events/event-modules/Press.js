/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = [
  'click',
  'keydown',
  'pointerdown',
  'pointercancel',
  'contextmenu',
];
const rootEventTypes = ['pointerup', 'scroll'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup');
}

function dispatchPressEvent(context, name, state, listener) {
  if (listener.length > 1) {
    const key = context.getClosestElementKeyFromTarget(state.pressTarget);
    context.dispatchBubbledEvent(
      name,
      e => listener(e, key),
      state.pressTarget,
    );
  } else {
    context.dispatchBubbledEvent(name, listener, state.pressTarget);
  }
}

function dispatchPressInEvents(context, props, state) {
  if (props.onPressIn) {
    context.dispatchBubbledEvent('pressin', props.onPressIn, state.pressTarget);
  }
  if (props.onPressChange) {
    let pressChangeEventListener;
    if (props.onPressChange.length === 2) {
      const key = context.getClosestElementKeyFromTarget(state.pressTarget);
      pressChangeEventListener = () => {
        props.onPressChange(true, key);
      };
    } else {
      pressChangeEventListener = () => {
        props.onPressChange(true);
      };
    }
    context.dispatchBubbledEvent(
      'presschange',
      pressChangeEventListener,
      state.pressTarget,
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
          state.pressTarget,
        );
      }
    }, longPressDelay);
  }
}

function dispatchPressOutEvents(context, props, state) {
  if (state.longPressTimeout !== null) {
    clearTimeout(state.longPressTimeout);
    state.longPressTimeout = null;
  }
  if (props.onPressOut) {
    context.dispatchBubbledEvent(
      'pressout',
      props.onPressOut,
      state.pressTarget,
    );
  }
  if (props.onPressChange) {
    const pressChangeEventListener = () => {
      props.onPressChange(false);
    };
    context.dispatchBubbledEvent(
      'presschange',
      pressChangeEventListener,
      state.pressTarget,
    );
  }
  if (props.onLongPressChange && state.isLongPressed) {
    const longPressChangeEventListener = () => {
      props.onLongPressChange(false);
    };
    context.dispatchBubbledEvent(
      'longpresschange',
      longPressChangeEventListener,
      state.pressTarget,
    );
  }
}

function isAnchorTagElement(eventTarget) {
  return eventTarget.nodeName === 'A';
}

const PressModule = {
  childEventTypes,
  createInitialState() {
    return {
      defaultPrevented: false,
      isAnchorTouched: false,
      isLongPressed: false,
      isPressed: false,
      longPressTimeout: null,
      pressTarget: null,
    };
  },
  handleEvent(context, props, state): void {
    const {eventTarget, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'keydown': {
        if (!props.onPress || context.isTargetOwned(eventTarget)) {
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
          keyPressEventListener = (e, key) => {
            if (!e.isDefaultPrevented() && !e.nativeEvent.defaultPrevented) {
              e.preventDefault();
              state.defaultPrevented = true;
              props.onPress(e, key);
            }
          };
        }
        dispatchPressEvent(context, 'press', state, keyPressEventListener);
        break;
      }
      case 'touchstart':
        // Touch events are for Safari, which lack pointer event support.
        if (!state.isPressed && !context.isTargetOwned(eventTarget)) {
          // We bail out of polyfilling anchor tags
          if (isAnchorTagElement(eventTarget)) {
            state.isAnchorTouched = true;
            return;
          }
          state.pressTarget = eventTarget;
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
          context.addRootEventTypes(rootEventTypes);
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
            if (target !== null && context.isTargetWithinEvent(target)) {
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
          state.isPressed = false;
          state.isLongPressed = false;
          // Prevent mouse events from firing
          nativeEvent.preventDefault();
          context.removeRootEventTypes(rootEventTypes);
        }
        break;
      }
      case 'pointerdown':
      case 'mousedown': {
        if (!state.isPressed && !context.isTargetOwned(eventTarget)) {
          if (nativeEvent.pointerType === 'mouse') {
            // Ignore if we are pressing on hit slop area with mouse
            if (context.isPositionWithinHitSlop(nativeEvent.x, nativeEvent.y)) {
              return;
            }
            // Ignore right-clicks
            if (nativeEvent.button === 2) {
              return;
            }
          }
          state.pressTarget = eventTarget;
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
          context.addRootEventTypes(rootEventTypes);
        }
        break;
      }
      case 'mouseup':
      case 'pointerup': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          if (
            state.pressTarget !== null &&
            (props.onPress || props.onLongPress)
          ) {
            if (context.isTargetWithinElement(eventTarget, state.pressTarget)) {
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
                const pressEventListener = (e, key) => {
                  props.onPress(e, key);
                  if (e.nativeEvent.defaultPrevented) {
                    state.defaultPrevented = true;
                  }
                };
                state.pressTarget = eventTarget;
                dispatchPressEvent(context, 'press', state, pressEventListener);
              }
            }
          }
          state.isPressed = false;
          state.isLongPressed = false;
          context.removeRootEventTypes(rootEventTypes);
        }
        state.isAnchorTouched = false;
        break;
      }
      case 'scroll':
      case 'touchcancel':
      case 'contextmenu':
      case 'pointercancel': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          state.isLongPressed = false;
          context.removeRootEventTypes(rootEventTypes);
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

export default PressModule;
