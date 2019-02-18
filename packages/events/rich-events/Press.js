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
    { listener, nativeEvent, targetElement, targetFiber, topLevelType },
    props,
    state,
    context,
  ): void {
    if (topLevelType === 'click' || topLevelType === 'keypress') {
      if (name === 'onPress') {
        let richEventListener = listener;

        if (topLevelType === 'keypress') {
          const isValidKeyPress =
            nativeEvent.which === 13 ||
            nativeEvent.which === 32 ||
            nativeEvent.keyCode === 13;

          if (!isValidKeyPress) {
            return;
          }
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
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      }
    } else if (topLevelType === 'pointerdown') {
      if (name === 'onPressIn') {
        const event = context.createRichEvent(
          'pressin',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (name === 'onPressChange') {
        listener(true);
      }
    } else if (topLevelType === 'pointerup') {
      if (name === 'onPressOut') {
        const event = context.createRichEvent(
          'pressup',
          listener,
          false,
          targetElement,
          targetFiber,
        );
        context.accumulateTwoPhaseDispatches(event);
      } else if (name === 'onPressChange') {
        listener(false);
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

export function onPressIn(props) {
  return {
    name: 'onPressIn',
    props,
    impl: PressImpl,
  };
}

export function onPressOut(props) {
  return {
    name: 'onPressOut',
    props,
    impl: PressImpl,
  };
}

export function onPressChange(props) {
  return {
    name: 'onPressChange',
    props,
    impl: PressImpl,
  };
}
