/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = [
  'click',
  'keydown',
  'pointerdown',
  'pointerover',
  'pointerout',
  'pointercancel',
];
const rootEventTypes = ['pointerup'];

// In the case we don't have PointerEvents (Safari), we listen to touch events
// too
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  childEventTypes.push(
    'touchstart',
    'touchend',
    'mousedown',
    'mouseover',
    'mouseout',
    'touchcancel',
  );
  rootEventTypes.push('mouseup');
}

function dispatchPressEvent(context, listener) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  context.dispatchTwoPhaseEvent(
    'press',
    listener,
    nativeEvent,
    eventTarget,
    eventTargetFiber,
    false,
  );
}

function dispatchPressInEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (props.onPressIn) {
    context.dispatchTwoPhaseEvent(
      'pressin',
      props.onPressIn,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
  if (props.onPressChange) {
    const pressChangeEventListener = () => {
      props.onPressChange(true);
    };
    context.dispatchTwoPhaseEvent(
      'presschange',
      pressChangeEventListener,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
}

function dispatchPressOutEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (props.onPressIn) {
    context.dispatchTwoPhaseEvent(
      'pressout',
      props.onPressOut,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
  if (props.onPressChange) {
    const pressChangeEventListener = () => {
      props.onPressChange(false);
    };
    context.dispatchTwoPhaseEvent(
      'presschange',
      pressChangeEventListener,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
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

function isAnchorTagElement(eventTarget) {
  return eventTarget.nodeName === 'A';
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

const PressImplementation = {
  childEventTypes,
  createInitialState(props) {
    const state = {
      defaultPrevented: false,
      isAnchorTouched: false,
      isHovered: false,
      isPressed: false,
      pressTarget: null,
      pressTargetFiber: null,
    };
    return state;
  },
  handleEvent(context, props, state): void {
    const {eventTarget, eventTargetFiber, eventType, nativeEvent} = context;

    switch (eventType) {
      case 'keydown': {
        if (!props.onPress) {
          return;
        }
        const isValidKeyPress =
          nativeEvent.which === 13 ||
          nativeEvent.which === 32 ||
          nativeEvent.keyCode === 13;

        if (!isValidKeyPress) {
          return;
        }
        let keyPressEventListener = props.onPress;

        // Wrap listener with prevent default behaviour, unless
        // we are dealing with an anchor
        if (!isAnchorTagElement(eventTarget)) {
          keyPressEventListener = e => {
            if (!e.isDefaultPrevented() && !e.nativeEvent.defaultPrevented) {
              e.preventDefault();
              state.defaultPrevented = true;
              props.onPress(e);
            }
          };
        }
        dispatchPressEvent(context, keyPressEventListener);
        break;
      }
      case 'touchstart':
        // Touch events are for Safari, which lack pointer event support
        if (!state.isPressed) {
          // We bail out of polyfilling anchor tags
          if (isAnchorTagElement(eventTarget)) {
            state.isAnchorTouched = true;
            return;
          }
          dispatchPressInEvents(context, props);
          state.isPressed = true;
        }
        break;
      case 'touchcancel':
      case 'touchend': {
        // Touch events are for Safari, which lack pointer event support
        if (state.isAnchorTouched) {
          return;
        }
        if (state.isPressed) {
          dispatchPressOutEvents(context, props);
          state.isPressed = false;
          if (eventType !== 'touchcancel' && props.onPress) {
            // Find if the X/Y of the end touch is still that of the original target
            const changedTouch = nativeEvent.changedTouches[0];
            const target = eventTarget.ownerDocument.elementFromPoint(
              changedTouch.clientX,
              changedTouch.clientY,
            );
            const targetFiber = context.getClosestInstanceFromNode(target);
            let traverseFiber = targetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === eventTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              dispatchPressEvent(context, props.onPress);
            }
          }
          // Prevent mouse events from firing
          nativeEvent.preventDefault();
        }
        break;
      }
      case 'pointerdown':
      case 'mousedown': {
        if (!state.isPressed) {
          dispatchPressInEvents(context, props);
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }
        break;
      }
      case 'mouseup':
      case 'pointerup': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          if (state.pressTargetFiber !== null && props.onPress) {
            let traverseFiber = eventTargetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === state.pressTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              const pressEventListener = e => {
                props.onPress(e);
                if (e.nativeEvent.defaultPrevented) {
                  state.defaultPrevented = true;
                }
              };
              dispatchPressEvent(context, pressEventListener);
            }
          }
          context.removeRootListeners(rootEventTypes);
        }
        state.isAnchorTouched = false;
        break;
      }
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
          dispatchHoverOutEvents(context, props, state);
          state.isHovered = false;
          if (isAnchorTagElement(eventTarget)) {
            nativeEvent.preventDefault();
          }
        }
        break;
      }
      case 'pointercancel': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
        }
        if (state.isHovered) {
          dispatchHoverOutEvents(context, props, state);
          state.isHovered = false;
        }
        break;
      }
      case 'click': {
        if (state.defaultPrevented) {
          nativeEvent.preventDefault();
          state.defaultPrevented = false;
        }
      }
    }
  },
};

export default function press(props) {
  return {
    impl: PressImplementation,
    props,
  };
}
