/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = ['pointerdown', 'pointercancel'];
const rootEventTypes = ['pointerup', 'pointermove'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup', 'touchmove', 'mousemove');
}

function dispatchSwipeEvent(context, name, listener, state, eventData) {
  context.dispatchTwoPhaseEvent(
    name,
    listener,
    context.nativeEvent,
    state.swipeTarget,
    state.swipeTargetFiber,
    false,
    eventData,
  );
}

const SwipeImplementation = {
  childEventTypes,
  createInitialState(props) {
    const state = {
      direction: 0,
      isSwiping: false,
      lastDirection: 0,
      startX: 0,
      startY: 0,
      swipeTarget: null,
      swipeTargetFiber: null,
      x: 0,
      y: 0,
    };
    window.addEventListener(
      'touchmove',
      e => {
        if (state.isSwiping) {
          e.preventDefault();
        }
      },
      {passive: false},
    );
    return state;
  },
  handleEvent(context, props, state): void {
    const {eventTarget, eventTargetFiber, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'touchstart':
      case 'mousedown':
      case 'pointerdown': {
        if (!state.isSwiping) {
          const obj =
            eventType === 'touchstart'
              ? nativeEvent.changedTouches[0]
              : nativeEvent;
          const x = (state.startX = obj.screenX);
          const y = (state.startY = obj.screenY);
          state.x = x;
          state.y = y;
          state.swipeTarget = eventTarget;
          state.swipeTargetFiber = eventTargetFiber;
          state.isSwiping = true;
          context.addRootListeners(rootEventTypes);
        }
        break;
      }
      case 'touchmove':
      case 'mousemove':
      case 'pointermove': {
        if (state.isSwiping) {
          const obj =
            eventType === 'touchmove'
              ? nativeEvent.changedTouches[0]
              : nativeEvent;
          const x = obj.screenX;
          const y = obj.screenY;
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
          }
        }
        break;
      }
      case 'touchend':
      case 'mouseup':
      case 'pointerup': {
        if (state.isSwiping) {
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
          state.swipeTargetFiber = null;
          context.removeRootListeners(rootEventTypes);
        }
        break;
      }
    }
  },
};

export default function swipeEvents(props) {
  return {
    impl: SwipeImplementation,
    props,
  };
}
