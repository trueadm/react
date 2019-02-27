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
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (isHoverWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onHoverIn) {
    context.dispatchTwoPhaseEvent(
      'hoverin',
      props.onHoverIn,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
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
      eventTargetFiber,
      false,
    );
  }
}

function dispatchHoverOutEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (isHoverWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onHoverOut) {
    context.dispatchTwoPhaseEvent(
      'hoverout',
      props.onHoverOut,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
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
      eventTargetFiber,
      false,
    );
  }
}

function isHoverWithinSameRichEventsFiber(context, nativeEvent) {
  const related = nativeEvent.relatedTarget;
  const richEventFiber = context.fiber;

  if (related != null) {
    let relatedFiber = context.getClosestInstanceFromNode(related);
    while (relatedFiber !== null) {
      if (
        relatedFiber === richEventFiber ||
        relatedFiber === richEventFiber.alternate
      ) {
        return true;
      }
      relatedFiber = relatedFiber.return;
    }
  }
  return false;
}

function targetIsHitSlop(eventTarget, nativeEvent, state) {
  const x = nativeEvent.clientX;
  const y = nativeEvent.clientY;
  const target = eventTarget.ownerDocument.elementFromPoint(x, y);
  if (target.nodeName === 'HIT-SLOP') {
    const {
      left,
      top,
      right,
      bottom,
    } = target.parentNode.getBoundingClientRect();
    if (x > left && y > top && x < right && y < bottom) {
      return false;
    }
    return true;
  }
  return false;
}

const HoverImplementation = {
  childEventTypes,
  createInitialState(props) {
    return {
      isHovered: false,
      isInHitSlop: false,
      isTouched: false,
    };
  },
  handleEvent(context, props, state): void {
    const {eventType, eventTarget, nativeEvent} = context;

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
          if (targetIsHitSlop(eventTarget, nativeEvent, state)) {
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
            if (!targetIsHitSlop(eventTarget, nativeEvent)) {
              dispatchHoverInEvents(context, props);
              state.isHovered = true;
              state.isInHitSlop = false;
            }
          } else if (
            state.isHovered &&
            targetIsHitSlop(eventTarget, nativeEvent)
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

export default function hoverEvents(props) {
  return {
    impl: HoverImplementation,
    props,
  };
}
