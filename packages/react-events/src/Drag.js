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

type DragState = {
  dragTarget: null | EventTarget,
  isPointerDown: boolean,
  isDragging: boolean,
  startX: number,
  startY: number,
  x: number,
  y: number,
};

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  targetEventTypes.push('touchstart', 'touchend', 'mousedown', 'touchcancel');
  rootEventTypes.push('mouseup', 'mousemove', 'touchmove');
}

function dispatchDragEvent(
  context: EventContext,
  name: string,
  listener: (e: Object) => void,
  state: DragState,
  eventData?: {
    diffX: number,
    diffY: number,
  },
): void {
  context.dispatchBubbledEvent(name, listener, state.dragTarget, eventData);
}

const DragResponder = {
  targetEventTypes,
  createInitialState(): DragState {
    return {
      dragTarget: null,
      isPointerDown: false,
      isDragging: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
    };
  },
  handleEvent(context: EventContext, props: Object, state: DragState): void {
    const {eventTarget, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'touchstart':
      case 'mousedown':
      case 'pointerdown': {
        if (!state.isDragging) {
          const obj =
            eventType === 'touchstart'
              ? (nativeEvent: any).changedTouches[0]
              : nativeEvent;
          const x = (state.startX = (obj: any).screenX);
          const y = (state.startY = (obj: any).screenY);
          state.x = x;
          state.y = y;
          state.dragTarget = eventTarget;
          state.isPointerDown = true;
          context.addRootEventTypes(rootEventTypes);
        }
        break;
      }
      case 'touchmove':
      case 'mousemove':
      case 'pointermove': {
        if (context.isPassive) {
          return;
        }
        if (state.isPointerDown) {
          const obj =
            eventType === 'touchmove'
              ? (nativeEvent: any).changedTouches[0]
              : nativeEvent;
          const x = (obj: any).screenX;
          const y = (obj: any).screenY;
          state.x = x;
          state.y = y;
          if (!state.isDragging && x !== state.startX && y !== state.startY) {
            let shouldEnableDragging = true;

            if (
              props.onShouldClaimOwnership &&
              props.onShouldClaimOwnership()
            ) {
              shouldEnableDragging = context.requestOwnership(state.dragTarget);
            }
            if (shouldEnableDragging) {
              state.isDragging = true;
              if (props.onDragChange) {
                const dragChangeEventListener = () => {
                  props.onDragChange(true);
                };
                context.dispatchBubbledEvent(
                  'dragchange',
                  dragChangeEventListener,
                  state.dragTarget,
                );
              }
            } else {
              state.dragTarget = null;
              state.isPointerDown = false;
              context.removeRootEventTypes(rootEventTypes);
            }
          } else {
            if (props.onDragMove) {
              const eventData = {
                diffX: x - state.startX,
                diffY: y - state.startY,
              };
              dispatchDragEvent(
                context,
                'dragmove',
                props.onDragMove,
                state,
                eventData,
              );
            }
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
        if (state.isDragging) {
          if (props.onShouldClaimOwnership) {
            context.releaseOwnership(state.dragTarget);
          }
          if (props.onDragEnd) {
            dispatchDragEvent(context, 'dragend', props.onDragEnd, state);
          }
          if (props.onDragChange) {
            const dragChangeEventListener = () => {
              props.onDragChange(false);
            };
            context.dispatchBubbledEvent(
              'dragchange',
              dragChangeEventListener,
              state.dragTarget,
            );
          }
          state.isDragging = false;
        }
        if (state.isPointerDown) {
          state.dragTarget = null;
          state.isPointerDown = false;
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
  responder: DragResponder,
};
