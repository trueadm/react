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
  rootEventTypes.push('mouseup', 'mousemove', 'touchmove');
}

function dispatchDragEvent(context, name, listener, state, eventData) {
  if (listener.length > 1) {
    const key = context.getClosestElementKeyFromTarget(state.dragTarget);
    context.dispatchBubbledEvent(
      name,
      e => listener(e, key),
      state.dragTarget,
      eventData,
    );
  } else {
    context.dispatchBubbledEvent(name, listener, state.dragTarget, eventData);
  }
}

const DragModule = {
  childEventTypes,
  createInitialState() {
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
  handleEvent(context, props, state): void {
    const {eventTarget, eventType, nativeEvent} = context;

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
              ? nativeEvent.changedTouches[0]
              : nativeEvent;
          const x = obj.screenX;
          const y = obj.screenY;
          state.x = x;
          state.y = y;
          if (!state.isDragging && x !== state.startX && y !== state.start) {
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
                let dragChangeEventListener;
                if (props.onDragChange.length === 2) {
                  const key = context.getClosestElementKeyFromTarget(
                    state.pressTarget,
                  );
                  dragChangeEventListener = () => {
                    props.onDragChange(true, key);
                  };
                } else {
                  dragChangeEventListener = () => {
                    props.onDragChange(true);
                  };
                }
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
            nativeEvent.preventDefault();
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
            let dragChangeEventListener;
            if (props.onDragChange.length === 2) {
              const key = context.getClosestElementKeyFromTarget(
                state.pressTarget,
              );
              dragChangeEventListener = () => {
                props.onDragChange(false, key);
              };
            } else {
              dragChangeEventListener = () => {
                props.onDragChange(false);
              };
            }
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

export default DragModule;
