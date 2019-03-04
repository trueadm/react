/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = [
  'pointerover',
  'pointermove',
  'pointerout',
  'pointercancel',
];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push('touchstart', 'mouseover', 'mouseout');
}

function dispatchHoverInEvents(context, props) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinEvent(nativeEvent.relatedTarget)) {
    return;
  }
  if (props.onHoverIn) {
    context.dispatchTwoPhaseEvent(
      'hoverin',
      props.onHoverIn,
      nativeEvent,
      eventTarget,
      false,
    );
  }
  if (props.onHoverChange) {
    const hoverChangeEventListener = () => {
      props.onHoverChange(true);
    };
    context.dispatchTwoPhaseEvent(
      'hoverchange',
      hoverChangeEventListener,
      nativeEvent,
      eventTarget,
      false,
    );
  }
}

function dispatchHoverOutEvents(context, props) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinEvent(nativeEvent.relatedTarget)) {
    return;
  }
  if (props.onHoverOut) {
    context.dispatchTwoPhaseEvent(
      'hoverout',
      props.onHoverOut,
      nativeEvent,
      eventTarget,
      false,
    );
  }
  if (props.onHoverChange) {
    const hoverChangeEventListener = () => {
      props.onHoverChange(false);
    };
    context.dispatchTwoPhaseEvent(
      'hoverchange',
      hoverChangeEventListener,
      nativeEvent,
      eventTarget,
      false,
    );
  }
}

const HoverModule = {
  childEventTypes,
  createInitialState(props) {
    return {
      isHovered: false,
      isInHitSlop: false,
      isTouched: false,
    };
  },
  handleEvent(context, props, state): void {
    const {eventType, nativeEvent} = context;

    switch (eventType) {
      case 'touchstart':
        // Touch devices don't have hover support
        if (!state.isTouched) {
          state.isTouched = true;
        }
        break;
      case 'pointerover':
      case 'mouseover': {
        if (!state.isHovered && !state.isTouched) {
          if (nativeEvent.pointerType === 'touch') {
            state.isTouched = true;
            return;
          }
          if (context.isPositionWithinHitSlop(nativeEvent.x, nativeEvent.y)) {
            state.isInHitSlop = true;
            return;
          }
          dispatchHoverInEvents(context, props);
          state.isHovered = true;
        }
        break;
      }
      case 'pointerout':
      case 'mouseout': {
        if (state.isHovered && !state.isTouched) {
          dispatchHoverOutEvents(context, props);
          state.isHovered = false;
        }
        state.isInHitSlop = false;
        state.isTouched = false;
        break;
      }
      case 'pointermove': {
        if (!state.isTouched) {
          if (state.isInHitSlop) {
            if (
              !context.isPositionWithinHitSlop(nativeEvent.x, nativeEvent.y)
            ) {
              dispatchHoverInEvents(context, props);
              state.isHovered = true;
              state.isInHitSlop = false;
            }
          } else if (
            state.isHovered &&
            context.isPositionWithinHitSlop(nativeEvent.x, nativeEvent.y)
          ) {
            dispatchHoverOutEvents(context, props);
            state.isHovered = false;
            state.isInHitSlop = true;
          }
        }
        break;
      }
      case 'pointercancel': {
        if (state.isHovered && !state.isTouched) {
          dispatchHoverOutEvents(context, props);
          state.isHovered = false;
          state.isTouched = false;
        }
        break;
      }
    }
  },
};

export default HoverModule;
