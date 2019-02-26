/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = ['pointerover', 'pointerout', 'pointercancel'];

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

const HoverImplementation = {
  childEventTypes,
  createInitialState(props) {
    return {
      isHovered: false,
      isTouching: false,
    };
  },
  handleEvent(context, props, state): void {
    const {eventType} = context;

    switch (eventType) {
      case 'touchstart':
        // Touch devices don't have hover support
        if (!state.isTouching) {
          state.isTouching = true;
        }
        break;
      case 'pointerover':
      case 'mouseover': {
        if (!state.isHovered && !state.isTouching) {
          dispatchHoverInEvents(context, props);
          state.isHovered = true;
        }
        break;
      }
      case 'pointerout':
      case 'mouseout': {
        if (state.isHovered && !state.isTouching) {
          dispatchHoverOutEvents(context, props);
          state.isHovered = false;
        }
        break;
      }
      case 'pointercancel': {
        if (state.isHovered && !state.isTouching) {
          dispatchHoverOutEvents(context, props);
          state.isHovered = false;
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
