/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export function addNativeBubbleEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
): Function {
  target.addEventListener(eventType, listener, false);
  return listener;
}

export function addNativeCaptureEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
): Function {
  target.addEventListener(eventType, listener, true);
  return listener;
}

export function addNativeCaptureEventListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean,
): Function {
  target.addEventListener(eventType, listener, {
    capture: true,
    passive,
  });
  return listener;
}

export function addNativeBubbleEventListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean,
): Function {
  target.addEventListener(eventType, listener, {
    passive,
  });
  return listener;
}

export function removeNativeEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  capture: boolean,
): void {
  target.removeEventListener(eventType, listener, capture);
}
