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
    return {};
  },
  processRichEvents(
    { type, listener, nativeEvent, targetElement, targetFiber, topLevelType },
    config,
    context,
  ): void {
    const related = nativeEvent.relatedTarget;
    const richEventsFiber = context.currentFiber;
    let relatedInsideRichEvent = false;

    if (related != null) {
      let relatedFiber = context.getClosestInstanceFromNode(related);
      while (relatedFiber !== null) {
        if (relatedFiber === richEventsFiber || relatedFiber === richEventsFiber.alternate) {
          return;
        }
        relatedFiber = relatedFiber.return;
      }
    }

    if (topLevelType === 'pointerover' || topLevelType === 'mouseover') {
      if (type === 'onHoverIn') {
        const event = context.createRichEvent(
          'hoverin',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (type === 'onHoverChange') {
        listener(true);
      }
    } else if (topLevelType === 'pointerout' || topLevelType === 'mouseout' || topLevelType === 'pointercancel') {
      if (type === 'onHoverOut') {
        const event = context.createRichEvent(
          'hoverout',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (type === 'onHoverChange') {
        listener(false);
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