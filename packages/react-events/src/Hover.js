/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {EventContext} from 'events/EventTypes';

const targetEventTypes = [
  'pointerover',
  'pointermove',
  'pointerout',
  'pointercancel',
];

type HoverState = {
  isHovered: boolean,
  isInHitSlop: boolean,
  isTouched: boolean,
};

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  targetEventTypes.push('touchstart', 'mouseover', 'mouseout');
}

function dispatchHoverInEvents(
  context: EventContext,
  props: Object,
  state: HoverState,
): void {
  const {nativeEvent, eventTarget} = context;
  if (props.onHoverChange) {
    if (context.isTargetWithinEvent((nativeEvent: any).relatedTarget)) {
      return;
    }
    if (props.onHoverIn) {
      context.dispatchBubbledEvent('hoverin', props.onHoverIn, eventTarget);
    }
    const hoverChangeEventListener = () => {
      props.onHoverChange(true);
    };
    context.dispatchBubbledEvent(
      'hoverchange',
      hoverChangeEventListener,
      eventTarget,
    );
  }
}

function dispatchHoverOutEvents(context: EventContext, props: Object) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinEvent((nativeEvent: any).relatedTarget)) {
    return;
  }
  if (props.onHoverOut) {
    context.dispatchBubbledEvent('hoverout', props.onHoverOut, eventTarget);
  }
  if (props.onHoverChange) {
    const hoverChangeEventListener = () => {
      props.onHoverChange(false);
    };
    context.dispatchBubbledEvent(
      'hoverchange',
      hoverChangeEventListener,
      eventTarget,
    );
  }
}

const HoverResponder = {
  targetEventTypes,
  createInitialState() {
    return {
      isHovered: false,
      isInHitSlop: false,
      isTouched: false,
    };
  },
  handleEvent(context: EventContext, props: Object, state: HoverState): void {
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
        if (
          !state.isHovered &&
          !state.isTouched &&
          !context.isTargetOwned(eventTarget)
        ) {
          if ((nativeEvent: any).pointerType === 'touch') {
            state.isTouched = true;
            return;
          }
          if (
            context.isPositionWithinTouchHitTarget(
              (nativeEvent: any).x,
              (nativeEvent: any).y,
            )
          ) {
            state.isInHitSlop = true;
            return;
          }
          dispatchHoverInEvents(context, props, state);
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
              !context.isPositionWithinTouchHitTarget(
                (nativeEvent: any).x,
                (nativeEvent: any).y,
              )
            ) {
              dispatchHoverInEvents(context, props, state);
              state.isHovered = true;
              state.isInHitSlop = false;
            }
          } else if (
            state.isHovered &&
            context.isPositionWithinTouchHitTarget(
              (nativeEvent: any).x,
              (nativeEvent: any).y,
            )
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

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
const hasSymbol = typeof Symbol === 'function' && Symbol.for;

const REACT_EVENT_TYPE = hasSymbol ? Symbol.for('react.event') : 0xead5;

export default {
  $$typeof: REACT_EVENT_TYPE,
  props: null,
  responder: HoverResponder,
};
