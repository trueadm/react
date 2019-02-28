/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import {RichEvents} from 'shared/ReactWorkTags';
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
export const currentRichEventFibers = new Set();
export const rootEventRichEventFibers = new Map();

function RichEventsContext(nativeEvent, eventType, impl) {
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

RichEventsContext.prototype.dispatchTwoPhaseEvent = function(
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

RichEventsContext.prototype.dispatchImmediateEvent = function(
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

RichEventsContext.prototype.extractEvents = function() {
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

RichEventsContext.prototype.addRootListeners = function(
  rootEventTypes,
  options,
) {
  const container = this.eventTarget.ownerDocument;
  const isListening = getListeningForDocument(container);
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
    let richEventFibers = rootEventRichEventFibers.get(rootEventType);
    if (richEventFibers === undefined) {
      richEventFibers = new Set();
      rootEventRichEventFibers.set(rootEventType, richEventFibers);
    }
    listenToDependency(rootEventType, isListening, container, options);
    richEventFibers.add(this._fiber);
  }
};

RichEventsContext.prototype.removeRootListeners = function(rootEventTypes) {
  for (let i = 0; i < rootEventTypes.length; i++) {
    const rootEventType = rootEventTypes[i];
    let richEventFibers = rootEventRichEventFibers.get(rootEventType);
    if (richEventFibers !== undefined) {
      richEventFibers.delete(this._fiber);
    }
  }
};

RichEventsContext.prototype.isPositionWithinHitSlop = function(x, y) {
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

RichEventsContext.prototype.isTargetWithinRichEvent = function(target) {
  const richEventFiber = this._fiber;

  if (target != null) {
    let fiber = getClosestInstanceFromNode(target);
    while (fiber !== null) {
      if (fiber === richEventFiber || fiber === richEventFiber.alternate) {
        return true;
      }
      fiber = fiber.return;
    }
  }
  return false;
};

RichEventsContext.prototype.isTargetWithinElement = function(
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

function handleEvents(fiber, context, nativeEventTarget, targetInst) {
  const listeners = fiber.memoizedProps.listeners;
  const richEventState = fiber.stateNode.richEventState;
  context._fiber = fiber;

  for (let i = 0; i < listeners.length; ++i) {
    const richEvent = listeners[i];
    const {impl, props} = richEvent;

    context.eventTarget = nativeEventTarget;

    let state = richEventState.get(impl);
    if (state === undefined) {
      state = impl.createInitialState(props);
      richEventState.set(impl, state);
    }
    impl.handleEvent(context, props, state);
  }
}

const RichEventsPlugin = {
  extractEvents: function(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget,
  ) {
    const context = new RichEventsContext(nativeEvent, topLevelType);
    let currentFiber = targetInst;

    while (currentFiber !== null) {
      if (currentFiber.tag === RichEvents) {
        if (!currentRichEventFibers.has(currentFiber)) {
          currentFiber = currentFiber.alternate;
        }
        handleEvents(currentFiber, context, nativeEventTarget, targetInst);
      }
      currentFiber = currentFiber.return;
    }
    if (rootEventRichEventFibers.has(topLevelType)) {
      const richEventFibers = rootEventRichEventFibers.get(topLevelType);
      const richEventFibersArr = Array.from(richEventFibers);

      for (let i = 0; i < richEventFibersArr.length; i++) {
        const richEventFiber = richEventFibersArr[i];
        handleEvents(richEventFiber, context, nativeEventTarget, targetInst);
      }
    }
    return context.extractEvents();
  },
};

export default RichEventsPlugin;
