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
  addNativeCaptureEventListener,
  addNativeBubbleEventListener,
  addNativeCaptureEventListenerWithPassiveFlag,
  addNativeBubbleEventListenerWithPassiveFlag,
} from './EventListener';

const registeredContainerStore = new Map();
const nativeGlobalStores = new Map();

function getEventKey(eventName: string, capture: boolean) {
  return `${eventName}__${capture ? 'capture' : 'bubble'}`;
}

function shouldUpgradeNativeEventListener(
  eventKey: string,
  newPassiveValue: void | boolean,
  listenerStore: {active: Function | null, passive: Function | null},
): boolean {
  const oldPassiveValue = listenerStore.passive !== null;
  return oldPassiveValue === true && !newPassiveValue;
}

function registerEventOnContainer(
  eventName: string,
  container: EventTarget,
  capture: boolean,
  passive: boolean | void,
  listener: Function,
): void {
  const eventKey = getEventKey(eventName, capture);
  let registeredContainers = registeredContainerStore.get(eventKey);

  if (registeredContainers === undefined) {
    registeredContainers = new WeakMap();
    registeredContainerStore.set(eventKey, registeredContainers);
  }

  let listeners = registeredContainers.get(container);
  if (listeners === undefined) {
    listeners = new Set();
    registeredContainers.set(container, listeners);
  }
  listeners.add(listener);

  const doc = (container: any).ownerDocument || container;
  let eventStore = nativeGlobalStores.get(doc);

  if (eventStore === undefined) {
    eventStore = new Map();
    nativeGlobalStores.set(doc, eventStore);
  }
  let listenerStore = eventStore.get(eventKey);
  if (listenerStore === undefined) {
    listenerStore = {
      active: null,
      passive: null,
    };
    eventStore.set(eventKey, listenerStore);
  }

  // Add a native window listener if one does not exist
  if (shouldUpgradeNativeEventListener(eventKey, passive, listenerStore)) {
    const managedPassiveListener = listenerStore.passive;
    listenerStore.passive = null;
    removeNativeEventListener(
      window,
      eventName,
      managedPassiveListener,
      capture,
    );
  } else if (
    listenerStore.active !== null ||
    (listenerStore.passive !== null && passive === true)
  ) {
    // If we already have an event listener, don't continue
    return;
  }
  const managedListener = eventManagerListener.bind(
    null,
    capture,
    registeredContainers,
  );
  if (passive) {
    listenerStore.passive = managedListener;
  } else {
    listenerStore.active = managedListener;
  }
  if (passive === undefined) {
    if (capture) {
      addNativeCaptureEventListener(doc, eventName, managedListener);
    } else {
      addNativeBubbleEventListener(doc, eventName, managedListener);
    }
  } else {
    if (capture) {
      addNativeCaptureEventListenerWithPassiveFlag(
        doc,
        eventName,
        managedListener,
        passive,
      );
    } else {
      addNativeBubbleEventListenerWithPassiveFlag(
        doc,
        eventName,
        managedListener,
        passive,
      );
    }
  }
}

function processListenersForTarget(
  target: EventTarget,
  registeredContainers: WeakMap<EventTarget, Set<Function>>,
  nativeEvent: Event,
): void {
  const listeners = registeredContainers.get(target);
  if (listeners !== undefined) {
    const listenersArr = Array.from(listeners);
    for (let i = 0; i < listenersArr.length; i++) {
      listenersArr[i](nativeEvent);
    }
  }
}

function buildPath(path: Array<Node>, nativeEventTarget: Node) {
  let currentTarget = nativeEventTarget;
  while (currentTarget != null) {
    path.push(currentTarget);
    currentTarget = currentTarget.parentNode;
  }
}

function eventManagerListener(
  capture: boolean,
  registeredContainers: WeakMap<EventTarget, Set<Function>>,
  nativeEvent: Event,
): void {
  const nativeEventTarget = ((nativeEvent.target: any): Node);

  if (capture) {
    // Capture phase
    const path = [window];
    buildPath(path, nativeEventTarget);
    for (let i = path.length - 1; i >= 0; i--) {
      processListenersForTarget(path[i], registeredContainers, nativeEvent);
    }
  } else {
    // Bubble phase
    const path = [];
    buildPath(path, nativeEventTarget);
    path.push(window);
    for (let i = 0; i < path.length; i++) {
      processListenersForTarget(path[i], registeredContainers, nativeEvent);
    }
  }
}

function hasRegisteredEventOnContainer(
  eventName: string,
  container: EventTarget,
  capture: boolean,
  passive: boolean | void,
): boolean {
  const eventKey = getEventKey(eventName, capture);
  const registeredContainers = registeredContainerStore.get(eventKey);

  if (registeredContainers !== undefined) {
    const doc = (container: any).ownerDocument || container;
    const eventStore = nativeGlobalStores.get(doc);
    if (eventStore === undefined) {
      return false;
    }
    const listenerStore = eventStore.get(eventKey);
    if (listenerStore === undefined) {
      return false;
    }
    return (
      registeredContainers.has(container) &&
      !shouldUpgradeNativeEventListener(eventKey, passive, listenerStore)
    );
  }
  return false;
}

export {registerEventOnContainer, hasRegisteredEventOnContainer};
