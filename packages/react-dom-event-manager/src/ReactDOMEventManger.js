/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {
  removeNativeEventListener,
  addNativeCaptureEventListenerWithPassiveFlag,
  addNativeBubbleEventListenerWithPassiveFlag,
} from './EventListener';

const registeredContainers = new WeakMap();
const hasPassiveNativeWindowListener = new Set();

function getEventKey(eventName: string, capture: boolean) {
  return `${eventName}__${capture ? 'capture' : 'bubble'}`;
}

function shouldUpgradeNativeEventListener(
  eventKey: string,
  newPassiveValue: void | boolean,
): boolean {
  const oldPassiveValue = hasPassiveNativeWindowListener.has(eventKey);
  return oldPassiveValue === true && !newPassiveValue;
}

function registerEventOnContainer(
  eventName: string,
  container: EventTarget,
  capture: boolean,
  passive: boolean | void,
  listener: Function,
): void {
  let eventStore = registeredContainers.get(container);
  if (eventStore === undefined) {
    eventStore = new Map();
    registeredContainers.set(container, eventStore);
  }
  const eventKey = getEventKey(eventName, capture);
  let listeners = eventStore.get(eventKey);

  if (listeners === undefined) {
    listeners = new Set();
    eventStore.set(eventKey, listeners);
  }
  listeners.add(listener);
  if (shouldUpgradeNativeEventListener(eventKey, passive)) {
    hasPassiveNativeWindowListener.delete(eventKey);
    removeNativeEventListener(window, eventName, eventManagerListener, capture);
  }

  if (passive === undefined) {

  } else {
    if (passive) {
      hasPassiveNativeWindowListener.add(eventKey);
    }
    if (capture) {
      addNativeCaptureEventListenerWithPassiveFlag(
        window,
        eventName,
        eventManagerListener,
        passive,
      );
    } else {
      addNativeBubbleEventListenerWithPassiveFlag(
        window,
        eventName,
        eventManagerListener,
        passive,
      );
    }
  }
}

function eventManagerListener() {}

function hasRegisteredEventOnContainer(
  eventName: string,
  container: EventTarget,
  capture: boolean,
  passive: boolean | void,
): boolean {
  const eventStore = registeredContainers.get(container);
  if (eventStore !== undefined) {
    const eventKey = getEventKey(eventName, capture);
    const listeners = eventStore.get(eventKey);
    return (
      listeners !== undefined ||
      shouldUpgradeNativeEventListener(eventKey, passive)
    );
  }
  return false;
}

export {registerEventOnContainer, hasRegisteredEventOnContainer};
