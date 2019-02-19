/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const listenTo = [
  'onPointerOver',
  'onPointerOut',
  'onPointerCancel',
];

// In the case we don't have PointerEvents (Safari), we listen to mouse events
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  listenTo.push('onMouseOver', 'onMouseOut');
}

const HoverImpl = {
  listenTo,
  createInitialState(config) {
    return {
      isHovered: false,
    };
  },
  processRichEvents(
    context,
    config,
    state,
  ): void {
    const { eventTarget, eventTargetFiber, eventType, eventListener, nativeEvent, richEventType } = context;
    const related = nativeEvent.relatedTarget;
    const richEventFiber = context.richEventFiber;
    let relatedInsideRichEvent = false;

    if (related != null) {
      let relatedFiber = context.getClosestInstanceFromNode(related);
      while (relatedFiber !== null) {
        if (relatedFiber === richEventFiber || relatedFiber === richEventFiber.alternate) {
          return;
        }
        relatedFiber = relatedFiber.return;
      }
    }

    if (eventType === 'pointerover' || eventType === 'mouseover') {
      if (richEventType === 'onHoverIn') {
        const event = context.createRichEvent(
          'hoverin',
          eventListener,
          false,
          eventTarget,
          eventTargetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (richEventType === 'onHoverChange') {
        if (!state.isHovered) {
          eventListener(true);
        }
        state.isHovered = true;
      }
    } else if (eventType === 'pointerout' || eventType === 'mouseout' || eventType === 'pointercancel') {
      if (richEventType === 'onHoverOut') {
        const event = context.createRichEvent(
          'hoverout',
          eventListener,
          false,
          eventTarget,
          eventTargetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (richEventType === 'onHoverChange') {
        if (state.isHovered) {
          eventListener(false);
        }
        state.isHovered = false;
      }
    }
  },
};

export function onHoverIn(config) {
  return {
    type: 'onHoverIn',
    config,
    impl: HoverImpl,
  };
}

onHoverIn.type = 'onHoverIn';
onHoverIn.config = null;
onHoverIn.impl = HoverImpl;

export function onHoverOut(config) {
  return {
    type: 'onHoverOut',
    config,
    impl: HoverImpl,
  };
}

onHoverOut.type = 'onHoverOut';
onHoverOut.config = null;
onHoverOut.impl = HoverImpl;

export function onHoverChange(config) {
  return {
    type: 'onHoverChange',
    config,
    impl: HoverImpl,
  };
}

onHoverChange.type = 'onHoverChange';
onHoverChange.config = null;
onHoverChange.impl = HoverImpl;