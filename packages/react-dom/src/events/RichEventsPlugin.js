/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import { RichEvents } from 'shared/ReactWorkTags';
import accumulateInto from 'events/accumulateInto';
import SyntheticEvent from 'events/SyntheticEvent';

import {getClosestInstanceFromNode} from '../client/ReactDOMComponentTree';

// To improve performance, this set contains the current "active" fiber
// of a pair of fibers who are each other's alternate.
export const currentRichEventFibers = new Set();

function RichEventsContext(nativeEvent, eventType) {
  this.bubblePhaseEvents = [];
  this.capturePhaseEvents = [];
  this.eventListener = null;
  this.eventTarget = null;
  this.eventTargetFiber = null;
  this.eventType = eventType;
  this.nativeEvent = nativeEvent;
  this.richEventType = null;
  this.richEventFiber = null;
}

RichEventsContext.prototype.createRichEvent = function (
  name,
  listener,
  capture,
  targetElement,
  targetFiber,
  nativeEvent,
) {
  return {
    name,
    listener,
    capture,
    targetElement,
    targetFiber,
    nativeEvent,
  };
};

RichEventsContext.prototype.accumulateTwoPhaseDispatches = function (richEvent) {
  if (Array.isArray(richEvent)) {
    // TODO
  } else {
    if (richEvent.capture) {
      this.capturePhaseEvents.unshift(richEvent);
    } else {
      this.bubblePhaseEvents.push(richEvent);
    }
  }
};

RichEventsContext.prototype.extractEvents = function () {
  let events;
  const richEvents = [...this.capturePhaseEvents, ...this.bubblePhaseEvents];
  for (let i = 0; i < richEvents.length; i++) {
    const richEvent = richEvents[i];
    const syntheticEvent = SyntheticEvent.getPooled(
      null,
      richEvent.targetFiber,
      this.nativeEvent,
      richEvent.targetElement,
    );
    syntheticEvent.type = richEvent.name;
    syntheticEvent._dispatchInstances = [richEvent.targetFiber];
    syntheticEvent._dispatchListeners = [richEvent.listener];
    events = accumulateInto(events, syntheticEvent);
  }
  return events;
};

RichEventsContext.prototype.getClosestInstanceFromNode = getClosestInstanceFromNode;

const RichEventsPlugin = {
  extractEvents: function (
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
        const listeners = currentFiber.memoizedProps.listeners;
        context.richEventFiber = currentFiber;

        for (let i = 0; i < listeners.length; i += 2) {
          const richEvent = listeners[i];
          const eventListener = listeners[i + 1];
          const { impl, type, config } = richEvent;

          context.richEventType = type;
          context.eventListener = eventListener;
          context.eventTargetFiber = targetInst;
          context.eventTarget = nativeEventTarget;

          let state = currentFiber.stateNode.get(impl);
          if (state === undefined) {
            state = impl.createInitialState(config);
            currentFiber.stateNode.set(impl, state);
          }
          impl.processRichEvents(
            context,
            config,
            state,
          );
        }
      }
      currentFiber = currentFiber.return;
    }
    return context.extractEvents();
  },
};

export default RichEventsPlugin;
