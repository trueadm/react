/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import type {AnyNativeEvent} from './PluginModuleType';
import type {TopLevelType} from 'events/TopLevelEventTypes';
import {Event} from 'shared/ReactWorkTags';
import accumulateInto from 'events/accumulateInto';
import SyntheticEvent from 'events/SyntheticEvent';
import {executeDispatch} from 'events/EventPluginUtils';
import type {ReactEventResponder} from 'shared/ReactTypes';
import {runEventsInBatch} from 'events/EventPluginHub';

import {getClosestInstanceFromNode} from '../client/ReactDOMComponentTree';
import {
  getListeningSetForElement,
  listenToDependency,
} from './ReactBrowserEventEmitter';
import warningWithoutStack from 'shared/warningWithoutStack';
import type {Fiber} from 'react-reconciler/src/ReactFiber';

// To improve performance, this set contains the current "active" fiber
// of a pair of fibers who are each other's alternate.
export const currentEventFibers: Set<Fiber> = new Set();
export const rootEventTypesToFibers: Map<TopLevelType, Set<Fiber>> = new Map();
export const eventResponderValidEventTypes: Map<
  ReactEventResponder,
  Set<TopLevelType>,
> = new Map();
export const targetOwnership: Map<EventTarget, Fiber> = new Map();

function EventContext(
  nativeEvent: AnyNativeEvent,
  eventType: TopLevelType,
  passive: boolean,
  nativeEventTarget: EventTarget,
) {
  this.bubblePhaseEvents = [];
  this.capturePhaseEvents = [];
  this.eventListener = null;
  this.eventTarget = nativeEventTarget;
  this.eventType = eventType;
  this.nativeEvent = nativeEvent;
  this.isPassive = passive;
  this._fiber = null;
  this._responder = null;
  this._eventsToRemove = null;
}

function copyEventData(eventData, syntheticEvent) {
  for (let propName in eventData) {
    syntheticEvent[propName] = eventData[propName];
  }
}

EventContext.prototype._dispatchTwoPhaseEvent = function(
  name,
  eventListener,
  eventTarget,
  isCapturePhase,
  eventData,
) {
  const eventTargetFiber = getClosestInstanceFromNode(eventTarget);
  const syntheticEvent = SyntheticEvent.getPooled(
    null,
    eventTargetFiber,
    this.nativeEvent,
    eventTarget,
  );
  if (eventData) {
    copyEventData(eventData, syntheticEvent);
  }
  syntheticEvent.type = name;
  syntheticEvent._dispatchInstances = [eventTargetFiber];
  syntheticEvent._dispatchListeners = [eventListener];

  if (isCapturePhase) {
    this.capturePhaseEvents.push(syntheticEvent);
  } else {
    this.bubblePhaseEvents.push(syntheticEvent);
  }
};

EventContext.prototype.dispatchBubbledEvent = function(
  name,
  eventListener,
  eventTarget,
  eventData,
) {
  this._dispatchTwoPhaseEvent(
    name,
    eventListener,
    eventTarget,
    false,
    eventData,
  );
};

EventContext.prototype.dispatchCapturedEvent = function(
  name,
  eventListener,
  eventTarget,
  eventData,
) {
  this._dispatchTwoPhaseEvent(
    name,
    eventListener,
    eventTarget,
    true,
    eventData,
  );
};

EventContext.prototype.dispatchImmediateEvent = function(
  name,
  eventListener,
  eventTarget,
  eventData,
) {
  const eventTargetFiber = getClosestInstanceFromNode(eventTarget);
  const syntheticEvent = SyntheticEvent.getPooled(
    null,
    eventTargetFiber,
    this.nativeEvent,
    eventTarget,
  );
  if (eventData) {
    copyEventData(eventData, syntheticEvent);
  }
  syntheticEvent.type = name;
  executeDispatch(syntheticEvent, eventListener, eventTargetFiber);
};

EventContext.prototype._extractEvents = function() {
  let events;
  for (let i = this.capturePhaseEvents.length; i-- > 0; ) {
    const syntheticEvent = this.capturePhaseEvents[i];
    events = accumulateInto(events, syntheticEvent);
  }
  for (let i = 0, length = this.bubblePhaseEvents.length; i < length; i++) {
    const syntheticEvent = this.bubblePhaseEvents[i];
    events = accumulateInto(events, syntheticEvent);
  }
  return events;
};

EventContext.prototype.getClosestElementKeyFromTarget = function(
  eventTarget,
): string | null {
  const eventTargetFiber = getClosestInstanceFromNode(eventTarget);
  let currentFiber = eventTargetFiber;

  while (currentFiber !== null) {
    if (currentFiber === this._fiber) {
      return null;
    }
    if (currentFiber.key !== null) {
      return currentFiber.key;
    }
    currentFiber = currentFiber.return;
  }
  return null;
};

EventContext.prototype.addRootEventTypes = function(rootEventTypes) {
  const container = this.eventTarget.ownerDocument;
  const listeningSet = getListeningSetForElement(container, false);
  const validEventTypesForResponder = eventResponderValidEventTypes.get(
    this._responder,
  );
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
    if (__DEV__) {
      warningWithoutStack(
        this._responder.targetEventTypes.indexOf(rootEventType) === -1,
        'addRootEventTypes: root event type "%s" already exists in targetEventTypes',
        rootEventType,
      );
    }
    if (validEventTypesForResponder.has(rootEventType)) {
      continue;
    }
    validEventTypesForResponder.add(rootEventType);
    let eventFibers = rootEventTypesToFibers.get(rootEventType);
    if (eventFibers === undefined) {
      eventFibers = new Set();
      rootEventTypesToFibers.set(rootEventType, eventFibers);
    }
    listenToDependency(rootEventType, listeningSet, container, false);
    eventFibers.add(this._fiber);
  }
};

EventContext.prototype.removeRootEventTypes = function(rootEventTypes) {
  if (this._eventsToRemove === null) {
    this._eventsToRemove = rootEventTypes;
  } else {
    this._eventsToRemove.push(...rootEventTypes);
  }
};

EventContext.prototype._deleteRootEventTypes = function() {
  const eventsToRemove = this._eventsToRemove;
  if (eventsToRemove === null) {
    return;
  }
  const validEventTypesForResponder = eventResponderValidEventTypes.get(
    this._responder,
  );
  for (let i = 0; i < eventsToRemove.length; i++) {
    const rootEventType = eventsToRemove[i];
    if (validEventTypesForResponder.has(rootEventType)) {
      validEventTypesForResponder.delete(rootEventType);
      let eventFibers = rootEventTypesToFibers.get(rootEventType);
      if (eventFibers !== undefined) {
        eventFibers.delete(this._fiber);
      }
    }
  }
};

EventContext.prototype.isPositionWithinHitSlop = function(x, y) {
  const target = this.eventTarget.ownerDocument.elementFromPoint(x, y);
  if (target.nodeName === 'HIT-SLOP') {
    const {
      left,
      top,
      right,
      bottom,
    } = target.parentNode.getBoundingClientRect();
    if (x > left && y > top && x < right && y < bottom) {
      return false;
    }
    return true;
  }
  return false;
};

EventContext.prototype.isTargetWithinEvent = function(target) {
  const eventFiber = this._fiber;

  if (target != null) {
    let fiber = getClosestInstanceFromNode(target);
    while (fiber !== null) {
      if (fiber === eventFiber || fiber === eventFiber.alternate) {
        return true;
      }
      fiber = fiber.return;
    }
  }
  return false;
};

EventContext.prototype.isTargetWithinElement = function(
  childTarget,
  parentTarget,
) {
  const childFiber = getClosestInstanceFromNode(childTarget);
  const parentFiber = getClosestInstanceFromNode(parentTarget);

  let currentFiber = childFiber;
  while (currentFiber !== null) {
    if (currentFiber === parentFiber) {
      return true;
    }
    currentFiber = currentFiber.return;
  }
  return false;
};

EventContext.prototype.isTargetOwned = function(targetElement) {
  const targetDoc = targetElement.ownerDocument;
  return targetOwnership.has(targetDoc);
};

EventContext.prototype.requestOwnership = function(targetElement) {
  const targetDoc = targetElement.ownerDocument;
  if (targetOwnership.has(targetDoc)) {
    return false;
  }
  targetOwnership.set(targetDoc, this._fiber);
  return true;
};

EventContext.prototype.releaseOwnership = function(targetElement) {
  const targetDoc = targetElement.ownerDocument;
  if (!targetOwnership.has(targetDoc)) {
    return false;
  }
  const owner = targetOwnership.get(targetDoc);
  if (owner === this._fiber || owner === this._fiber.alternate) {
    targetOwnership.delete(targetDoc);
    return true;
  }
  return false;
};

function handleTopLevelType(
  topLevelType: TopLevelType,
  fiber: Fiber,
  context: EventContext,
): void {
  const responder = fiber.type.responder;
  const props = fiber.memoizedProps;
  const stateNode = fiber.stateNode;
  context._fiber = fiber;
  let validEventTypesForResponder = eventResponderValidEventTypes.get(
    responder,
  );

  if (validEventTypesForResponder === undefined) {
    validEventTypesForResponder = new Set(responder.targetEventTypes);
    eventResponderValidEventTypes.set(responder, validEventTypesForResponder);
  }
  if (!validEventTypesForResponder.has(topLevelType)) {
    return;
  }
  context._responder = responder;

  let state = stateNode.get(responder);
  if (state === undefined) {
    state = responder.createInitialState(props);
    stateNode.set(responder, state);
  }
  responder.handleEvent(context, props, state);
}

export function handleResponderEvents(
  topLevelType: TopLevelType,
  targetFiber: Fiber,
  nativeEvent: AnyNativeEvent,
  nativeEventTarget: EventTarget,
  passive: boolean,
) {
  const context = new EventContext(
    nativeEvent,
    topLevelType,
    passive,
    nativeEventTarget,
  );
  let currentFiber = targetFiber;

  while (currentFiber !== null) {
    if (currentFiber.tag === Event) {
      if (!currentEventFibers.has(currentFiber)) {
        currentFiber = currentFiber.alternate;
      }
      handleTopLevelType(topLevelType, currentFiber, context);
    }
    currentFiber = currentFiber.return;
  }
  if (rootEventTypesToFibers.has(topLevelType)) {
    const eventFibers = rootEventTypesToFibers.get(topLevelType);
    const eventFibersArr = Array.from(((eventFibers: any): Set<Fiber>));

    for (let i = 0; i < eventFibersArr.length; i++) {
      const eventFiber = eventFibersArr[i];
      handleTopLevelType(topLevelType, eventFiber, context);
    }
  }
  context._deleteRootEventTypes();
  runEventsInBatch(context._extractEvents());
}
