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

// To improve performance, this set contains the current "active" fiber
// of a pair of fibers who are each other's alternate.
export const currentEventFibers = new Set();
export const rootEventTypesToFibers = new Map();

function EventContext(nativeEvent, eventType) {
  this.bubblePhaseEvents = [];
  this.capturePhaseEvents = [];
  this.eventListener = null;
  this.eventTarget = null;
  this.eventType = eventType;
  this._fiber = null;
  this.nativeEvent = nativeEvent;
}

function copyEventData(eventData, syntheticEvent) {
  for (let propName in eventData) {
    syntheticEvent[propName] = eventData[propName];
  }
}

EventContext.prototype.dispatchTwoPhaseEvent = function(
  name,
  eventListener,
  nativeEvent,
  eventTarget,
  isCapturePhase,
  eventData,
) {
  const eventTargetFiber = getClosestInstanceFromNode(eventTarget);
  const syntheticEvent = SyntheticEvent.getPooled(
    null,
    eventTargetFiber,
    nativeEvent,
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

EventContext.prototype.dispatchImmediateEvent = function(
  name,
  eventListener,
  nativeEvent,
  eventTarget,
  eventData,
) {
  const eventTargetFiber = getClosestInstanceFromNode(eventTarget);
  const syntheticEvent = SyntheticEvent.getPooled(
    null,
    eventTargetFiber,
    nativeEvent,
    eventTarget,
  );
  if (eventData) {
    copyEventData(eventData, syntheticEvent);
  }
  syntheticEvent.type = name;
  executeDispatch(syntheticEvent, eventListener, eventTargetFiber);
};

EventContext.prototype.extractEvents = function() {
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

EventContext.prototype.addRootListeners = function(
  rootEventTypes,
  options,
) {
  const container = this.eventTarget.ownerDocument;
  const isListening = getListeningForDocument(container);
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
    let eventFibers = rootEventTypesToFibers.get(rootEventType);
    if (eventFibers === undefined) {
      eventFibers = new Set();
      rootEventTypesToFibers.set(rootEventType, eventFibers);
    }
    listenToDependency(rootEventType, isListening, container, options);
    eventFibers.add(this._fiber);
  }
};

EventContext.prototype.removeRootListeners = function(rootEventTypes) {
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
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

function handleEvent(
  eventModule,
  topLevelType,
  nativeEventTarget,
  context,
  props,
  eventState,
): void {
  if (eventModule.childEventTypes.indexOf(topLevelType) === -1) {
    return;
  }
  context.eventTarget = nativeEventTarget;

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
  ) {
    const context = new EventContext(nativeEvent, topLevelType);
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
    return context.extractEvents();
  },
};

export default UnstableEventPlugin;
