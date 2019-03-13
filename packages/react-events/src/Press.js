/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {EventContext} from 'events/EventTypes';

const targetEventTypes = [
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
  targetEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup');
}

type PressState = {
  defaultPrevented: boolean,
  isAnchorTouched: boolean,
  isLongPressed: boolean,
  isPressed: boolean,
  longPressTimeout: null | TimeoutID,
  pressTarget: null | EventTarget,
};

function dispatchPressEvent(
  context: EventContext,
  name: string,
  state: PressState,
  listener: (e: Object) => void,
): void {
  context.dispatchBubbledEvent(name, listener, state.pressTarget);
}

function dispatchPressInEvents(
  context: EventContext,
  props: Object,
  state: PressState,
): void {
  if (props.onPressIn) {
    context.dispatchBubbledEvent('pressin', props.onPressIn, state.pressTarget);
  }
  if (props.onPressChange) {
    const pressChangeEventListener = () => {
      props.onPressChange(true);
    };
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

function dispatchPressOutEvents(
  context: EventContext,
  props: Object,
  state: PressState,
): void {
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

function isAnchorTagElement(eventTarget: EventTarget): boolean {
  return (eventTarget: any).nodeName === 'A';
}

const PressResponder = {
  targetEventTypes,
  createInitialState(): PressState {
    return {
      defaultPrevented: false,
      isAnchorTouched: false,
      isLongPressed: false,
      isPressed: false,
      longPressTimeout: null,
      pressTarget: null,
    };
  },
  handleEvent(context: EventContext, props: Object, state: PressState): void {
    const {eventTarget, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'keydown': {
        if (!props.onPress || context.isTargetOwned(eventTarget)) {
          return;
        }
        const isValidKeyPress =
          (nativeEvent: any).which === 13 ||
          (nativeEvent: any).which === 32 ||
          (nativeEvent: any).keyCode === 13;

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
            const changedTouch = (nativeEvent: any).changedTouches[0];
            const doc = (eventTarget: any).ownerDocument;
            const target = doc.elementFromPoint(
              changedTouch.screenX,
              changedTouch.screenY,
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
          (nativeEvent: any).preventDefault();
          context.removeRootEventTypes(rootEventTypes);
        }
        break;
      }
      case 'pointerdown':
      case 'mousedown': {
        if (!state.isPressed && !context.isTargetOwned(eventTarget)) {
          if ((nativeEvent: any).pointerType === 'mouse') {
            // Ignore if we are pressing on hit slop area with mouse
            if (
              context.isPositionWithinTouchHitTarget(
                (nativeEvent: any).x,
                (nativeEvent: any).y,
              )
            ) {
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
        if (state.isPressed && !context.isPassive) {
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
        if (state.defaultPrevented && !context.isPassive) {
          (nativeEvent: any).preventDefault();
          state.defaultPrevented = false;
        }
      }
    }
  },
};

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
const hasSymbol = typeof Symbol === 'function' && Symbol.for;

const REACT_EVENT_TYPE = hasSymbol ? Symbol.for('react.event') : 0xead5;

export default {
  $$typeof: REACT_EVENT_TYPE,
  props: null,
  responder: PressResponder,
};
