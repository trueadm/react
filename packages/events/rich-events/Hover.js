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

function isAnchorTagElement(eventTarget) {
  return eventTarget.nodeName === 'A';
}

function dispatchHoverInEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (isHoverWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onHoverIn) {
    context.dispatchTwoPhaseEvent(
      'focusin',
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
      isAnchorTouched: false,
      isHovered: false,
    };
  },
  handleEvent(context, props, state): void {
    const {eventTarget, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'touchstart':
        // Touch events are for Safari, which lack pointer event support
        if (!state.isHovered) {
          // We bail out of polyfilling anchor tags
          if (isAnchorTagElement(eventTarget)) {
            state.isAnchorTouched = true;
          }
        }
        break;
      case 'pointerover':
      case 'mouseover': {
        if (!state.isHovered && !state.isAnchorTouched) {
          dispatchHoverInEvents(context, props);
          state.isHovered = true;
        }
        break;
      }
      case 'pointerout':
      case 'mouseout': {
        if (state.isHovered && !state.isAnchorTouched) {
          dispatchHoverOutEvents(context, props);
          state.isHovered = false;
          if (isAnchorTagElement(eventTarget)) {
            nativeEvent.preventDefault();
          }
        }
        break;
      }
      case 'pointercancel': {
        if (state.isHovered) {
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
