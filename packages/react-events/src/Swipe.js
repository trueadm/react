/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {EventContext} from 'events/EventTypes';

const targetEventTypes = ['pointerdown', 'pointercancel'];
const rootEventTypes = ['pointerup', 'pointermove'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  targetEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup', 'mousemove', 'touchmove');
}

function dispatchSwipeEvent(
  context: EventContext,
  name: string,
  listener: (e: Object) => void,
  state: SwipeState,
  eventData?: {
    diffX: number,
    diffY: number,
  },
) {
  context.dispatchBubbledEvent(name, listener, state.swipeTarget, eventData);
}

type SwipeState = {
  direction: number,
  isSwiping: boolean,
  lastDirection: number,
  startX: number,
  startY: number,
  touchId: null | number,
  swipeTarget: null | EventTarget,
  x: number,
  y: number,
};

const SwipeResponder = {
  targetEventTypes,
  createInitialState(): SwipeState {
    return {
      direction: 0,
      isSwiping: false,
      lastDirection: 0,
      startX: 0,
      startY: 0,
      touchId: null,
      swipeTarget: null,
      x: 0,
      y: 0,
    };
  },
  handleEvent(context: EventContext, props: Object, state: SwipeState): void {
    const {eventTarget, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'touchstart':
      case 'mousedown':
      case 'pointerdown': {
        if (!state.isSwiping && !context.isTargetOwned(eventTarget)) {
          let obj = nativeEvent;
          if (eventType === 'touchstart') {
            obj = (nativeEvent: any).targetTouches[0];
            state.touchId = obj.identifier;
          }
          const x = (obj: any).screenX;
          const y = (obj: any).screenY;

          let shouldEnableSwiping = true;

          if (props.onShouldClaimOwnership && props.onShouldClaimOwnership()) {
            shouldEnableSwiping = context.requestOwnership(eventTarget);
          }
          if (shouldEnableSwiping) {
            state.isSwiping = true;
            state.startX = x;
            state.startY = y;
            state.x = x;
            state.y = y;
            state.swipeTarget = eventTarget;
            context.addRootEventTypes(rootEventTypes);
          } else {
            state.touchId = null;
          }
        }
        break;
      }
      case 'touchmove':
      case 'mousemove':
      case 'pointermove': {
        if (context.isPassive) {
          return;
        }
        if (state.isSwiping) {
          let obj = null;
          if (eventType === 'touchmove') {
            const targetTouches = (nativeEvent: any).targetTouches;
            for (let i = 0; i < targetTouches.length; i++) {
              if (state.touchId === targetTouches[i].identifier) {
                obj = targetTouches[i];
                break;
              }
            }
          } else {
            obj = nativeEvent;
          }
          if (obj === null) {
            state.isSwiping = false;
            state.swipeTarget = null;
            state.touchId = null;
            context.removeRootEventTypes(rootEventTypes);
            return;
          }
          const x = (obj: any).screenX;
          const y = (obj: any).screenY;
          if (x < state.x && props.onSwipeLeft) {
            state.direction = 3;
          } else if (x > state.x && props.onSwipeRight) {
            state.direction = 1;
          }
          state.x = x;
          state.y = y;
          if (props.onSwipeMove) {
            const eventData = {
              diffX: x - state.startX,
              diffY: y - state.startY,
            };
            dispatchSwipeEvent(
              context,
              'swipemove',
              props.onSwipeMove,
              state,
              eventData,
            );
            (nativeEvent: any).preventDefault();
          }
        }
        break;
      }
      case 'pointercancel':
      case 'touchcancel':
      case 'touchend':
      case 'mouseup':
      case 'pointerup': {
        if (state.isSwiping) {
          if (state.x === state.startX && state.y === state.startY) {
            return;
          }
          if (props.onShouldClaimOwnership) {
            context.releaseOwnership(state.swipeTarget);
          }
          const direction = state.direction;
          const lastDirection = state.lastDirection;
          if (direction !== lastDirection) {
            if (props.onSwipeLeft && direction === 3) {
              dispatchSwipeEvent(
                context,
                'swipeleft',
                props.onSwipeLeft,
                state,
              );
            } else if (props.onSwipeRight && direction === 1) {
              dispatchSwipeEvent(
                context,
                'swiperight',
                props.onSwipeRight,
                state,
              );
            }
          }
          if (props.onSwipeEnd) {
            dispatchSwipeEvent(context, 'swipeend', props.onSwipeEnd, state);
          }
          state.lastDirection = direction;
          state.isSwiping = false;
          state.swipeTarget = null;
          state.touchId = null;
          context.removeRootEventTypes(rootEventTypes);
        }
        break;
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
  responder: SwipeResponder,
};
