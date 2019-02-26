/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const childEventTypes = ['focus', 'blur'];

function dispatchFocusInEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (isFocusWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onFocus) {
    context.dispatchTwoPhaseEvent(
      'focus',
      props.onHoverIn,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
  if (props.onFocusChange) {
    const focusChangeEventListener = () => {
      props.onFocusChange(true);
    };
    context.dispatchTwoPhaseEvent(
      'focuschange',
      focusChangeEventListener,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
}

function dispatchFocusOutEvents(context, props) {
  const {nativeEvent, eventTarget, eventTargetFiber} = context;
  if (isFocusWithinSameRichEventsFiber(context, nativeEvent)) {
    return;
  }
  if (props.onBlur) {
    context.dispatchTwoPhaseEvent(
      'blur',
      props.onHoverOut,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
  if (props.onFocusChange) {
    const focusChangeEventListener = () => {
      props.onFocusChange(false);
    };
    context.dispatchTwoPhaseEvent(
      'focuschange',
      focusChangeEventListener,
      nativeEvent,
      eventTarget,
      eventTargetFiber,
      false,
    );
  }
}

function isFocusWithinSameRichEventsFiber(context, nativeEvent) {
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
  createInitialState() {
    return {
      isFocused: false,
    };
  },
  handleEvent(context, props, state): void {
    const {eventType} = context;

    switch (eventType) {
      case 'focus': {
        if (!state.isFocused) {
          dispatchFocusInEvents(context, props);
          state.isFocused = true;
        }
        break;
      }
      case 'blur': {
        if (state.isFocused) {
          dispatchFocusOutEvents(context, props);
          state.isFocused = false;
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
