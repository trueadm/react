/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const PressImpl = {
  listenTo: ['onKeyPress', 'onClick', 'onPointerDown', 'onPointerUp'],
  createInitialState(props) {
    return {};
  },
  processRichEvents(
    name,
    {listener, nativeEvent, targetElement, targetFiber, topLevelType},
    props,
    state,
    context,
  ): void {
    const isCaptureOnPress = name === 'onPressCapture';
    if (name === 'onPress' || isCaptureOnPress) {
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
          'press',
          richEventListener,
          isCaptureOnPress,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      }
    }
  },
};

export function onPress(props) {
  return {
    name: 'onPress',
    props,
    impl: PressImpl,
  };
}

export function onPressCapture(props) {
  return {
    name: 'onPressCapture',
    props,
    impl: PressImpl,
  };
}

export function onPressIn(props) {
  return {
    name: 'onPressIn',
    props,
    impl: PressImpl,
  };
}
