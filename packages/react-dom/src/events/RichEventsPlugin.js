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
  this.fiber = null;
  this.nativeEvent = nativeEvent;
}

RichEventsContext.prototype.dispatchTwoPhaseEvent = function(
  name,
  eventListener,
  nativeEvent,
  eventTarget,
  eventTargetFiber,
  isCapturePhase,
) {
  const syntheticEvent = SyntheticEvent.getPooled(
    null,
    eventTargetFiber,
    nativeEvent,
    eventTarget,
  );
  syntheticEvent.type = name;
  syntheticEvent._dispatchInstances = [eventTargetFiber];
  syntheticEvent._dispatchListeners = [eventListener];

  if (isCapturePhase) {
    this.capturePhaseEvents.push(syntheticEvent);
  } else {
    this.bubblePhaseEvents.push(syntheticEvent);
  }
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

RichEventsContext.prototype.getClosestInstanceFromNode = getClosestInstanceFromNode;

RichEventsContext.prototype.addRootListeners = function() {

};

RichEventsContext.prototype.removeRootListeners = function() {

};

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
        const listeners = currentFiber.memoizedProps.listeners;
        context.richEventFiber = currentFiber;

        for (let i = 0; i < listeners.length; ++i) {
          const richEvent = listeners[i];
          const {impl, props} = richEvent;

          context.fiber = targetInst;
          context.eventTarget = nativeEventTarget;

          let state = currentFiber.stateNode.get(impl);
          if (state === undefined) {
            state = impl.createInitialState(props);
            currentFiber.stateNode.set(impl, state);
          }
          impl.onChildEvent(context, props, state);
        }
      }
      currentFiber = currentFiber.return;
    }
    return context.extractEvents();
  },
};

export default RichEventsPlugin;
