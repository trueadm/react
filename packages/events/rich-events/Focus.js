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
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinRichEvent(nativeEvent.relatedTarget)) {
    return;
  }
  if (props.onFocus) {
    context.dispatchTwoPhaseEvent(
      'focus',
      props.onFocus,
      nativeEvent,
      eventTarget,
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
      false,
    );
  }
}

function dispatchFocusOutEvents(context, props) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinRichEvent(nativeEvent.relatedTarget)) {
    return;
  }
  if (props.onBlur) {
    context.dispatchTwoPhaseEvent(
      'blur',
      props.onBlur,
      nativeEvent,
      eventTarget,
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
      false,
    );
  }
}

const FocusImplementation = {
  childEventTypes,
  createInitialState(props) {
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

export default function focusEvents(props) {
  return {
    impl: FocusImplementation,
    props,
  };
}
