/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const PressImpl = {
  listenTo: ['onKeyPress', 'onClick'],
  createInitialState(props) {
    return {};
  },
  processRichEvents(
    {listener, nativeEvent, targetElement, targetFiber, topLevelType},
    props,
    state,
    context,
  ): void {
    let richEventListener = listener;
    const isKeyPress =
      topLevelType === 'keypress' &&
      (nativeEvent.which === 13 ||
        nativeEvent.which === 32 ||
        nativeEvent.keyCode === 13);
    if (topLevelType === 'click' || isKeyPress) {
      if (isKeyPress) {
        // Wrap listener with prevent default behaviour
        richEventListener = e => {
          if (!e.isDefaultPrevented() && !e.nativeEvent.defaultPrevented) {
            e.preventDefault();
            listener(e);
          }
        };
      }
      const event = context.createRichEvent(
        'onPress',
        richEventListener,
        PressImpl,
        targetElement,
        targetFiber,
      );
      context.accumulateTwoPhaseDispatches(event);
    }
  },
};

const defaultConfig = {
  capture: false,
  props: null,
  impl: PressImpl,
};

const defaultCaptureConfig = {
  capture: true,
  props: null,
  impl: PressImpl,
};

export function onPress(props) {
  return {...defaultConfig, props};
}

export function onPressCapture(props) {
  return {...defaultCaptureConfig, props};
}

export function onPressIn(props) {
  return {...defaultConfig, props};
}
