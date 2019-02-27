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
  'pointercancel',
  'pointerover',
  'pointerout',
];
const rootEventTypes = ['pointerup', 'scroll'];
const HostComponent = 5;
const excludeElementsFromHitSlop = new Set([
  'IFRAME',
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'SELECT',
  'INPUT',
  'KEYGEN',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
  'MENUITEM',
  'VIDEO',
  'CANVAS',
]);

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

function dispatchPressEvent(context, name, state, listener) {
  const {nativeEvent} = context;
  context.dispatchTwoPhaseEvent(
    name,
    listener,
    nativeEvent,
    state.pressTarget,
    state.pressTargetFiber,
    false,
  );
}

function dispatchPressInEvents(context, props, state) {
  const {nativeEvent} = context;
  if (props.onPressIn) {
    context.dispatchTwoPhaseEvent(
      'pressin',
      props.onPressIn,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
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
      state.pressTarget,
      state.pressTargetFiber,
      false,
    );
  }
  if (!state.isLongPressed && (props.onLongPress || props.onLongPressChange)) {
    const longPressDelay = props.longPressDelay || 1000;
    state.longPressTimeout = setTimeout(() => {
      state.isLongPressed = true;
      state.longPressTimeout = null;
      if (props.onLongPressChange) {
        const longPressChangeEventListener = () => {
          props.onLongPressChange(true);
        };
        context.dispatchImmediateEvent(
          'longpresschange',
          longPressChangeEventListener,
          nativeEvent,
          state.pressTarget,
          state.pressTargetFiber,
        );
      }
    }, longPressDelay);
  }
}

function dispatchPressOutEvents(context, props, state) {
  const {nativeEvent} = context;
  if (state.longPressTimeout !== null) {
    clearTimeout(state.longPressTimeout);
    state.longPressTimeout = null;
  }
  if (props.onPressOut) {
    context.dispatchTwoPhaseEvent(
      'pressout',
      props.onPressOut,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
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
      state.pressTarget,
      state.pressTargetFiber,
      false,
    );
  }
  if (props.onLongPressChange && state.isLongPressed) {
    const longPressChangeEventListener = () => {
      props.onLongPressChange(false);
    };
    context.dispatchTwoPhaseEvent(
      'longpresschange',
      longPressChangeEventListener,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
      false,
    );
  }
}

function dispatchHoverInEvents(context, props, state) {
  const {nativeEvent} = context;
  if (isHoverWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onHoverIn) {
    context.dispatchTwoPhaseEvent(
      'hoverin',
      props.onHoverIn,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
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
      state.pressTarget,
      state.pressTargetFiber,
      false,
    );
  }
}

function dispatchHoverOutEvents(context, props, state) {
  const {nativeEvent} = context;
  if (isHoverWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onHoverOut) {
    context.dispatchTwoPhaseEvent(
      'hoverout',
      props.onHoverOut,
      nativeEvent,
      state.pressTarget,
      state.pressTargetFiber,
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
      state.pressTarget,
      state.pressTargetFiber,
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

function isAnchorTagElement(eventTarget) {
  return eventTarget.nodeName === 'A';
}

function getChildDomElementsFromFiber(fiber) {
  const domElements = [];
  let currentFiber = fiber.child;

  while (currentFiber !== null) {
    if (currentFiber.tag === HostComponent) {
      domElements.push(currentFiber.stateNode);
      currentFiber = currentFiber.return;
      if (currentFiber === fiber) {
        break;
      }
    } else if (currentFiber.child !== null) {
      currentFiber = currentFiber.child;
    }
    if (currentFiber.sibling !== null) {
      currentFiber = currentFiber.sibling;
    } else {
      break;
    }
  }
  return domElements;
}

const PointerImplementation = {
  childEventTypes,
  rootEventTypes,
  createInitialState() {
    return {
      childElements: null,
      defaultPrevented: false,
      isAnchorTouched: false,
      isLongPressed: false,
      isHovered: false,
      isPressed: false,
      isTouched: false,
      longPressTimeout: null,
      pressTarget: null,
      pressTargetFiber: null,
    };
  },
  handleCommit(fiber, props, state) {
    const hitSlop = props.hitSlop;
    if (hitSlop == null) {
      return;
    }
    const lastChildElements = state.childElements;
    const nextChildElements = getChildDomElementsFromFiber(fiber);
    const lastChildElementsLength =
      lastChildElements !== null ? lastChildElements.length : 0;

    for (let i = 0; i < nextChildElements.length; i++) {
      const nextChild = nextChildElements[i];
      if (excludeElementsFromHitSlop.has(nextChild.nodeName)) {
        continue;
      }
      let nedsHitSlopElement = !(
        lastChildElementsLength > i && lastChildElements[i] === nextChild
      );

      if (nedsHitSlopElement) {
        const hitSlopElement = nextChild.ownerDocument.createElement(
          'hit-slop',
        );
        nextChild.style.position = 'relative';
        nextChild.style.zIndex = '0';
        hitSlopElement.style.position = 'absolute';
        hitSlopElement.style.display = 'block';
        hitSlopElement.style.zIndex = '-1';
        if (hitSlop.top) {
          hitSlopElement.style.top = `-${hitSlop.top}px`;
        }
        if (hitSlop.left) {
          hitSlopElement.style.left = `-${hitSlop.left}px`;
        }
        if (hitSlop.right) {
          hitSlopElement.style.right = `-${hitSlop.right}px`;
        }
        if (hitSlop.bottom) {
          hitSlopElement.style.bottom = `-${hitSlop.bottom}px`;
        }
        nextChild.appendChild(hitSlopElement);
      }
    }

    state.childElements = nextChildElements;
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
        dispatchPressEvent(context, 'press', state, keyPressEventListener);
        break;
      }
      case 'touchstart':
        // Touch events are for Safari, which lack pointer event support.
        if (!state.isPressed) {
          state.isTouched = true;
          // We bail out of polyfilling anchor tags
          if (isAnchorTagElement(eventTarget)) {
            state.isAnchorTouched = true;
            return;
          }
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }

        break;
      case 'touchend': {
        // Touch events are for Safari, which lack pointer event support
        if (state.isAnchorTouched) {
          return;
        }
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          if (
            eventType !== 'touchcancel' &&
            (props.onPress || props.onLongPress)
          ) {
            // Find if the X/Y of the end touch is still that of the original target
            const changedTouch = nativeEvent.changedTouches[0];
            const target = eventTarget.ownerDocument.elementFromPoint(
              changedTouch.clientX,
              changedTouch.clientY,
            );
            if (target !== null) {
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
                if (state.isLongPressed && props.onLongPress) {
                  dispatchPressEvent(
                    context,
                    'longpress',
                    state,
                    props.onLongPress,
                  );
                } else if (props.onPress) {
                  dispatchPressEvent(context, 'press', state, props.onPress);
                }
              }
            }
          }
          state.isPressed = false;
          state.isLongPressed = false;
          // Prevent mouse events from firing
          nativeEvent.preventDefault();
          context.removeRootListeners(rootEventTypes);
        }
        break;
      }
      case 'pointerdown':
      case 'mousedown': {
        if (!state.isPressed) {
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          dispatchPressInEvents(context, props, state);
          state.isPressed = true;
          context.addRootListeners(rootEventTypes);
        }
        break;
      }
      case 'mouseup':
      case 'pointerup': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          if (
            state.pressTargetFiber !== null &&
            (props.onPress || props.onLongPress)
          ) {
            let traverseFiber = eventTargetFiber;
            let triggerPress = false;

            while (traverseFiber !== null) {
              if (traverseFiber === state.pressTargetFiber) {
                triggerPress = true;
              }
              traverseFiber = traverseFiber.return;
            }
            if (triggerPress) {
              if (state.isLongPressed && props.onLongPress) {
                const longPressEventListener = e => {
                  props.onLongPress(e);
                  if (e.nativeEvent.defaultPrevented) {
                    state.defaultPrevented = true;
                  }
                };
                dispatchPressEvent(
                  context,
                  'longpress',
                  state,
                  longPressEventListener,
                );
              } else if (props.onPress) {
                const pressEventListener = e => {
                  props.onPress(e);
                  if (e.nativeEvent.defaultPrevented) {
                    state.defaultPrevented = true;
                  }
                };
                dispatchPressEvent(context, 'press', state, pressEventListener);
              }
            }
          }
          state.isPressed = false;
          state.isLongPressed = false;
          context.removeRootListeners(rootEventTypes);
        }
        state.isAnchorTouched = false;
        break;
      }
      case 'scroll':
      case 'touchcancel':
      case 'pointercancel': {
        if (state.isPressed) {
          dispatchPressOutEvents(context, props, state);
          state.isPressed = false;
          state.isLongPressed = false;
        }
        if (state.isHovered && !state.isTouched) {
          dispatchHoverOutEvents(context, props, state);
          state.isHovered = false;
        }
        break;
      }
      case 'pointerover':
      case 'mouseover': {
        if (!state.isHovered && !state.isTouched) {
          state.pressTarget = eventTarget;
          state.pressTargetFiber = eventTargetFiber;
          dispatchHoverInEvents(context, props, state);
          state.isHovered = true;
        }
        break;
      }
      case 'pointerout':
      case 'mouseout': {
        if (state.isHovered && !state.isTouched) {
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

export default function pointerEvents(props) {
  return {
    impl: PointerImplementation,
    props,
  };
}
