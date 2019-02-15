/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const onPressImpl = {
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
        onPressImpl,
        targetElement,
        targetFiber,
      );
      context.accumulateTwoPhaseDispatches(event);
    }
  },
};

export function onPress(props) {
  return {
    capture: true,
    props,
    impl: onPressImpl,
  };
}
onPress.capture = false;
onPress.props = {};
onPress.impl = onPressImpl;

export function onPressCapture(props) {
  return {
    capture: true,
    props,
    impl: onPressImpl,
  };
}
onPressCapture.capture = true;
onPressCapture.props = {};
onPressCapture.impl = onPressImpl;
