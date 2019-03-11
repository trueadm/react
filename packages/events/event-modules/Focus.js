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
  if (context.isTargetWithinEvent(nativeEvent.relatedTarget)) {
    return;
  }
  if (props.onFocus) {
    context.dispatchBubbledEvent('focus', props.onFocus, eventTarget);
  }
  if (props.onFocusChange) {
    const focusChangeEventListener = () => {
      props.onFocusChange(true);
    };
    context.dispatchBubbledEvent(
      'focuschange',
      focusChangeEventListener,
      eventTarget,
    );
  }
}

function dispatchFocusOutEvents(context, props) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinEvent(nativeEvent.relatedTarget)) {
    return;
  }
  if (props.onBlur) {
    context.dispatchBubbledEvent('blur', props.onBlur, eventTarget);
  }
  if (props.onFocusChange) {
    const focusChangeEventListener = () => {
      props.onFocusChange(false);
    };
    context.dispatchBubbledEvent(
      'focuschange',
      focusChangeEventListener,
      eventTarget,
    );
  }
}

const FocusModule = {
  childEventTypes,
  createInitialState(props) {
    return {
      isFocused: false,
    };
  },
  handleEvent(context, props, state): void {
    const {eventTarget, eventType} = context;

    switch (eventType) {
      case 'focus': {
        if (!state.isFocused && !context.isTargetOwned(eventTarget)) {
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

export default FocusModule;
