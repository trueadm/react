/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  ReactDOMEventResponder,
  ReactDOMResponderEvent,
  ReactDOMResponderContext,
  PointerType,
} from 'shared/ReactDOMTypes';

import React from 'react';
import {DiscreteEvent} from 'shared/ReactTypes';

type FocusProps = {
  disabled: boolean,
  onBlur: (e: FocusEvent) => void,
  onFocus: (e: FocusEvent) => void,
  onFocusChange: boolean => void,
  onFocusVisibleChange: boolean => void,
  autoFocus: boolean,
  contain: boolean,
  restoreFocus: boolean,
};

type FocusState = {
  currentFocusedNode: null | Element | Document,
  focusTarget: null | Element | Document,
  isFocused: boolean,
  isLocalFocusVisible: boolean,
  nodeToRestore: null | Element | Document,
  pointerType: PointerType,
};

type FocusEventType = 'focus' | 'blur' | 'focuschange' | 'focusvisiblechange';

type FocusEvent = {|
  target: Element | Document,
  type: FocusEventType,
  pointerType: PointerType,
  timeStamp: number,
|};

const isMac =
  typeof window !== 'undefined' && window.navigator != null
    ? /^Mac/.test(window.navigator.platform)
    : false;

const targetEventTypes = ['focus', 'blur', 'keydown_active'];

const rootEventTypes = [
  'keydown',
  'keyup',
  'pointermove',
  'pointerdown',
  'pointerup',
];

// If PointerEvents is not supported (e.g., Safari), also listen to touch and mouse events.
if (typeof window !== 'undefined' && window.PointerEvent === undefined) {
  rootEventTypes.push(
    'mousemove',
    'mousedown',
    'mouseup',
    'touchmove',
    'touchstart',
    'touchend',
  );
}

function createFocusEvent(
  context: ReactDOMResponderContext,
  type: FocusEventType,
  target: Element | Document,
  pointerType: PointerType,
): FocusEvent {
  return {
    target,
    type,
    pointerType,
    timeStamp: context.getTimeStamp(),
  };
}

function isValidTabPress(nativeEvent): boolean {
  return (
    nativeEvent.key === 'Tab' &&
    !(
      nativeEvent.metaKey ||
      (!isMac && nativeEvent.altKey) ||
      (nativeEvent: any).ctrlKey
    )
  );
}

function dispatchFocusInEvents(
  context: ReactDOMResponderContext,
  props: FocusProps,
  state: FocusState,
) {
  const pointerType = state.pointerType;
  const target = ((state.focusTarget: any): Element | Document);
  if (props.onFocus) {
    const syntheticEvent = createFocusEvent(
      context,
      'focus',
      target,
      pointerType,
    );
    context.dispatchEvent(syntheticEvent, props.onFocus, DiscreteEvent);
  }
  if (props.onFocusChange) {
    const listener = () => {
      props.onFocusChange(true);
    };
    const syntheticEvent = createFocusEvent(
      context,
      'focuschange',
      target,
      pointerType,
    );
    context.dispatchEvent(syntheticEvent, listener, DiscreteEvent);
  }
  if (props.onFocusVisibleChange && state.isLocalFocusVisible) {
    const listener = () => {
      props.onFocusVisibleChange(true);
    };
    const syntheticEvent = createFocusEvent(
      context,
      'focusvisiblechange',
      target,
      pointerType,
    );
    context.dispatchEvent(syntheticEvent, listener, DiscreteEvent);
  }
}

function dispatchFocusOutEvents(
  context: ReactDOMResponderContext,
  props: FocusProps,
  state: FocusState,
) {
  const pointerType = state.pointerType;
  const target = ((state.focusTarget: any): Element | Document);
  if (props.onBlur) {
    const syntheticEvent = createFocusEvent(
      context,
      'blur',
      target,
      pointerType,
    );
    context.dispatchEvent(syntheticEvent, props.onBlur, DiscreteEvent);
  }
  if (props.onFocusChange) {
    const listener = () => {
      props.onFocusChange(false);
    };
    const syntheticEvent = createFocusEvent(
      context,
      'focuschange',
      target,
      pointerType,
    );
    context.dispatchEvent(syntheticEvent, listener, DiscreteEvent);
  }
  dispatchFocusVisibleOutEvent(context, props, state);
}

function getFirstFocusableElement(
  context: ReactDOMResponderContext,
): Element | null {
  const elements = context.getFocusableElementsInScope();
  if (elements.length > 0) {
    return elements[0] || null;
  }
  return null;
}

function focusElement(element: Element | Document | null) {
  if (element != null) {
    try {
      ((element: any): HTMLElement).focus();
    } catch (err) {}
  }
}

function dispatchFocusVisibleOutEvent(
  context: ReactDOMResponderContext,
  props: FocusProps,
  state: FocusState,
) {
  const pointerType = state.pointerType;
  const target = ((state.focusTarget: any): Element | Document);
  if (props.onFocusVisibleChange && state.isLocalFocusVisible) {
    const listener = () => {
      props.onFocusVisibleChange(false);
    };
    const syntheticEvent = createFocusEvent(
      context,
      'focusvisiblechange',
      target,
      pointerType,
    );
    context.dispatchEvent(syntheticEvent, listener, DiscreteEvent);
    state.isLocalFocusVisible = false;
  }
}

function unmountResponder(
  context: ReactDOMResponderContext,
  props: FocusProps,
  state: FocusState,
): void {
  if (state.isFocused) {
    dispatchFocusOutEvents(context, props, state);
  }
}

function handleRootPointerEvent(
  event: ReactDOMResponderEvent,
  context: ReactDOMResponderContext,
  props: FocusProps,
  state: FocusState,
): void {
  const {type, target} = event;
  // Ignore a Safari quirks where 'mousemove' is dispatched on the 'html'
  // element when the window blurs.
  if (type === 'mousemove' && target.nodeName === 'HTML') {
    return;
  }

  isGlobalFocusVisible = false;

  // Focus should stop being visible if a pointer is used on the element
  // after it was focused using a keyboard.
  const focusTarget = state.focusTarget;
  if (
    focusTarget !== null &&
    context.isTargetWithinNode(event.target, focusTarget) &&
    (type === 'mousedown' || type === 'touchstart' || type === 'pointerdown')
  ) {
    dispatchFocusVisibleOutEvent(context, props, state);
  }
}

function getActiveFocusedElement(
  context: ReactDOMResponderContext,
): Element | Document | null {
  return context.getActiveDocument().activeElement;
}

let isGlobalFocusVisible = true;

const FocusResponder: ReactDOMEventResponder = {
  displayName: 'Focus',
  targetEventTypes,
  rootEventTypes,
  getInitialState(): FocusState {
    return {
      currentFocusedNode: null,
      focusTarget: null,
      isFocused: false,
      isLocalFocusVisible: false,
      nodeToRestore: null,
      pointerType: '',
    };
  },
  allowMultipleHostChildren: false,
  allowEventHooks: true,
  onEvent(
    event: ReactDOMResponderEvent,
    context: ReactDOMResponderContext,
    props: FocusProps,
    state: FocusState,
  ): void {
    const {nativeEvent, type, target} = event;

    if (props.disabled) {
      if (state.isFocused) {
        dispatchFocusOutEvents(context, props, state);
        state.isFocused = false;
        state.focusTarget = null;
      }
      return;
    }

    switch (type) {
      case 'keydown': {
        if (isValidTabPress(nativeEvent)) {
          const focusedElement = getActiveFocusedElement(context);
          if (
            focusedElement !== null &&
            context.isTargetWithinEventComponent(focusedElement)
          ) {
            // We don't need to manually handle the tab, as a child
            // <Focus> will have done it for us.
            if (context.isRespondingToHook()) {
              state.currentFocusedNode = focusedElement;
              return;
            }
            const elements = context.getFocusableElementsInScope();
            const position = elements.indexOf(focusedElement);
            const lastPosition = elements.length - 1;
            let nextElement = null;

            if (nativeEvent.shiftKey) {
              if (position === 0) {
                if (props.contain) {
                  nextElement = elements[lastPosition];
                } else {
                  // Out of bounds
                  context.continueLocalPropagation();
                  return;
                }
              } else {
                nextElement = elements[position - 1];
              }
            } else {
              if (position === lastPosition) {
                if (props.contain) {
                  nextElement = elements[0];
                } else {
                  // Out of bounds
                  context.continueLocalPropagation();
                  return;
                }
              } else {
                nextElement = elements[position + 1];
              }
            }
            if (nextElement !== null) {
              focusElement(nextElement);
              state.currentFocusedNode = nextElement;
              ((nativeEvent: any): KeyboardEvent).preventDefault();
            }
          }
        }
        break;
      }
      case 'focus': {
        if (!state.isFocused) {
          // Limit focus events to the direct child of the event component.
          // Browser focus is not expected to bubble.
          state.focusTarget = event.responderTarget;
          if (state.focusTarget === target) {
            state.isFocused = true;
            state.isLocalFocusVisible = isGlobalFocusVisible;
            dispatchFocusInEvents(context, props, state);
          }
        }
        break;
      }
      case 'blur': {
        if (state.isFocused) {
          dispatchFocusOutEvents(context, props, state);
          state.isFocused = false;
          state.focusTarget = null;
        }
        break;
      }
    }
  },
  onRootEvent(
    event: ReactDOMResponderEvent,
    context: ReactDOMResponderContext,
    props: FocusProps,
    state: FocusState,
  ): void {
    const {target, type} = event;

    switch (type) {
      case 'focus': {
        // Handle global focus containment
        if (props.contain) {
          if (!context.isTargetWithinEventComponent(target)) {
            const currentFocusedNode = state.currentFocusedNode;
            if (currentFocusedNode !== null) {
              focusElement(currentFocusedNode);
            } else if (props.autoFocus) {
              const firstElement = getFirstFocusableElement(context);
              focusElement(firstElement);
            }
          }
        }
        break;
      }
      case 'mousemove':
      case 'mousedown':
      case 'mouseup': {
        state.pointerType = 'mouse';
        handleRootPointerEvent(event, context, props, state);
        break;
      }
      case 'pointermove':
      case 'pointerdown':
      case 'pointerup': {
        // $FlowFixMe: Flow doesn't know about PointerEvents
        const nativeEvent = ((event.nativeEvent: any): PointerEvent);
        state.pointerType = nativeEvent.pointerType;
        handleRootPointerEvent(event, context, props, state);
        break;
      }
      case 'touchmove':
      case 'touchstart':
      case 'touchend': {
        state.pointerType = 'touch';
        handleRootPointerEvent(event, context, props, state);
        break;
      }

      case 'keydown':
      case 'keyup': {
        const nativeEvent = event.nativeEvent;
        if (isValidTabPress(nativeEvent)) {
          state.pointerType = 'keyboard';
          isGlobalFocusVisible = true;
        }
        break;
      }
    }
  },
  onMount(
    context: ReactDOMResponderContext,
    props: FocusProps,
    state: FocusState,
  ): void {
    if (props.restoreFocus) {
      state.nodeToRestore = getActiveFocusedElement(context);
    }
    if (props.autoFocus) {
      const firstElement = getFirstFocusableElement(context);
      focusElement(firstElement);
    }
  },
  onUnmount(
    context: ReactDOMResponderContext,
    props: FocusProps,
    state: FocusState,
  ) {
    if (props.restoreFocus && state.nodeToRestore !== null) {
      focusElement(state.nodeToRestore);
    }
    unmountResponder(context, props, state);
  },
  onOwnershipChange(
    context: ReactDOMResponderContext,
    props: FocusProps,
    state: FocusState,
  ) {
    unmountResponder(context, props, state);
  },
};

export const Focus = React.unstable_createEvent(FocusResponder);

export function useFocus(props: FocusProps): void {
  React.unstable_useEvent(Focus, props);
}
