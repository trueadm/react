/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export function addEventBubbleListener(
  element: Document | Element | Node,
  eventType: string,
  listener: Function,
  isPassive: boolean | null,
): void {
  if (isPassive === null) {
    element.addEventListener(eventType, listener, false);
  } else {
    element.addEventListener(eventType, listener, {
      passive: isPassive,
      capture: false,
    });
  }
}

export function addEventCaptureListener(
  element: Document | Element | Node,
  eventType: string,
  listener: Function,
  isPassive: boolean | null,
): void {
  if (isPassive === null) {
    element.addEventListener(eventType, listener, true);
  } else {
    element.addEventListener(eventType, listener, {
      passive: isPassive,
      capture: true,
    });
  }
}
