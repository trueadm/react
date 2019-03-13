/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {EventContext} from 'events/EventTypes';

const targetEventTypes = ['focus', 'blur'];

type FocusState = {
  isFocused: boolean,
};

function dispatchFocusInEvents(context: EventContext, props: Object) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinEvent((nativeEvent: any).relatedTarget)) {
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

function dispatchFocusOutEvents(context: EventContext, props: Object) {
  const {nativeEvent, eventTarget} = context;
  if (context.isTargetWithinEvent((nativeEvent: any).relatedTarget)) {
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

const FocusResponder = {
  targetEventTypes,
  createInitialState(): FocusState {
    return {
      isFocused: false,
    };
  },
  handleEvent(context: EventContext, props: Object, state: FocusState): void {
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

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
const hasSymbol = typeof Symbol === 'function' && Symbol.for;

const REACT_EVENT_TYPE = hasSymbol ? Symbol.for('react.event') : 0xead5;

export default {
  $$typeof: REACT_EVENT_TYPE,
  props: null,
  responder: FocusResponder,
};
