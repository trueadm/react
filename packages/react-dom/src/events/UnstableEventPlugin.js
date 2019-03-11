/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import {Event} from 'shared/ReactWorkTags';
import accumulateInto from 'events/accumulateInto';
import SyntheticEvent from 'events/SyntheticEvent';
import {executeDispatch} from 'events/EventPluginUtils';

import {getClosestInstanceFromNode} from '../client/ReactDOMComponentTree';
import {
  getListeningForDocument,
  listenToDependency,
} from './ReactBrowserEventEmitter';
import warningWithoutStack from 'shared/warningWithoutStack';

// To improve performance, this set contains the current "active" fiber
// of a pair of fibers who are each other's alternate.
export const currentEventFibers = new Set();
export const rootEventTypesToFibers = new Map();
export const eventModuleValidEventTypes = new Map();
export const targetOwnership = new Map();

function EventContext(nativeEvent, eventType, passive) {
  this.bubblePhaseEvents = [];
  this.capturePhaseEvents = [];
  this.eventListener = null;
  this.eventTarget = null;
  this.eventType = eventType;
  this.nativeEvent = nativeEvent;
  this.isPassive = passive;
  this._fiber = null;
  this._eventModule = null;
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
  const listeningObject = getListeningForDocument(container);
  const validEventTypesForModule = eventModuleValidEventTypes.get(
    this._eventModule,
  );
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
    if (__DEV__) {
      warningWithoutStack(
        this._eventModule.childEventTypes.indexOf(rootEventType) === -1,
        'addRootEventTypes: root event type "%s" already exists in childEventTypes',
        rootEventType,
      );
    }
    if (validEventTypesForModule.has(rootEventType)) {
      continue;
    }
    validEventTypesForModule.add(rootEventType);
    let eventFibers = rootEventTypesToFibers.get(rootEventType);
    if (eventFibers === undefined) {
      eventFibers = new Set();
      rootEventTypesToFibers.set(rootEventType, eventFibers);
    }
    listenToDependency(rootEventType, listeningObject, container, true);
    listenToDependency(rootEventType, listeningObject, container, false);
    eventFibers.add(this._fiber);
  }
};

EventContext.prototype.removeRootEventTypes = function(rootEventTypes) {
  const validEventTypesForModule = eventModuleValidEventTypes.get(
    this._eventModule,
  );
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
    validEventTypesForModule.delete(rootEventType);
    let eventFibers = rootEventTypesToFibers.get(rootEventType);
    if (eventFibers !== undefined) {
      eventFibers.delete(this._fiber);
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

function handleEvent(
  eventModule,
  topLevelType,
  nativeEventTarget,
  context,
  props,
  eventState,
): void {
  let validEventTypesForModule = eventModuleValidEventTypes.get(eventModule);

  if (validEventTypesForModule === undefined) {
    validEventTypesForModule = new Set(eventModule.childEventTypes);
    eventModuleValidEventTypes.set(eventModule, validEventTypesForModule);
  }
  if (!validEventTypesForModule.has(topLevelType)) {
    return;
  }
  context.eventTarget = nativeEventTarget;
  context._eventModule = eventModule;

  let state = eventState.get(eventModule);
  if (state === undefined) {
    state = eventModule.createInitialState(props);
    eventState.set(eventModule, state);
  }
  eventModule.handleEvent(context, props, state);
}

function handleEvents(
  topLevelType,
  fiber,
  context,
  nativeEventTarget,
  targetInst,
): void {
  const modules = fiber.type.modules;
  const props = fiber.memoizedProps;
  const eventState = fiber.stateNode.eventState;
  context._fiber = fiber;

  if (Array.isArray(modules)) {
    for (let i = 0; i < modules.length; ++i) {
      handleEvent(
        modules[i],
        topLevelType,
        nativeEventTarget,
        context,
        props,
        eventState,
      );
    }
  } else {
    handleEvent(
      modules,
      topLevelType,
      nativeEventTarget,
      context,
      props,
      eventState,
    );
  }
}

const UnstableEventPlugin = {
  extractEvents: function(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    passive,
  ) {
    // We skip over legacy events that had no passive boolean flag.
    // All events with the new event API will have true/false for isPassive.
    if (passive === undefined) {
      return;
    }
    const context = new EventContext(nativeEvent, topLevelType, passive);
    let currentFiber = targetInst;

    while (currentFiber !== null) {
      if (currentFiber.tag === Event) {
        if (!currentEventFibers.has(currentFiber)) {
          currentFiber = currentFiber.alternate;
        }
        handleEvents(
          topLevelType,
          currentFiber,
          context,
          nativeEventTarget,
          targetInst,
        );
      }
      currentFiber = currentFiber.return;
    }
    if (rootEventTypesToFibers.has(topLevelType)) {
      const eventFibers = rootEventTypesToFibers.get(topLevelType);
      const eventFibersArr = Array.from(eventFibers);

      for (let i = 0; i < eventFibersArr.length; i++) {
        const eventFiber = eventFibersArr[i];
        handleEvents(
          topLevelType,
          eventFiber,
          context,
          nativeEventTarget,
          targetInst,
        );
      }
    }
    return context._extractEvents();
  },
};

export default UnstableEventPlugin;
