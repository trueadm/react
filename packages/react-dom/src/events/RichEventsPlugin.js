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

function RichEventsContext(nativeEvent) {
  this.capturePhaseEvents = [];
  this.bubblePhaseEvents = [];
  this.nativeEvent = nativeEvent;

}

RichEventsContext.prototype.createRichEvent = function(
  name,
  listener,
  impl,
  targetElement,
  targetFiber,
  nativeEvent,
) {
  return {
    name,
    listener,
    impl,
    targetElement,
    targetFiber,
    nativeEvent,
  };
};

RichEventsContext.prototype.accumulateTwoPhaseDispatches = function(richEvent) {
  if (Array.isArray(richEvent)) {
    // TODO
  } else {
    const impl = richEvent.impl;
    if (impl.capture) {
      this.capturePhaseEvents.unshift(richEvent);
    } else {
      this.bubblePhaseEvents.push(richEvent);
    }
  }
};

RichEventsContext.prototype.extractEvents = function() {
  let events;
  const richEvents = [...this.capturePhaseEvents, ...this.bubblePhaseEvents];
  for (let i = 0; i < richEvents.length; i++) {
    const richEvent = richEvents[i];
    const syntheticEvent = SyntheticEvent.getPooled(
      richEvent.name,
      richEvent.targetFiber,
      this.nativeEvent,
      richEvent.targetElement,
    );
    syntheticEvent._dispatchInstances = [richEvent.targetFiber];
    syntheticEvent._dispatchListeners = [richEvent.listener];
    events = accumulateInto(events, syntheticEvent);
  }
  return events;
};

const RichEventsPlugin = {
  extractEvents: function(
    topLevelType,
    targetInst,
    nativeEvent,
    nativeEventTarget,
  ) {
    const context = new RichEventsContext(nativeEvent);
    let currentFiber = targetInst;
    while (currentFiber !== null) {
      if (currentFiber.tag === RichEvents) {
        const listeners = currentFiber.memoizedProps.listeners;
        
        for (let i = 0; i < listeners.length; i += 2) {
          const richEvent = listeners[i];
          const listener = listeners[i + 1];
          const impl = richEvent.impl;
          const props = richEvent.props;

          let state = currentFiber.stateNode.get(impl);
          if (state === undefined) {
            state = impl.createInitialState(props);
            currentFiber.stateNode.set(impl, state);
          }
          const event = {
            listener,
            topLevelType,
            nativeEvent,
            targetFiber: targetInst,
            targetElement: nativeEventTarget,
          };
          impl.processRichEvents(
            event,
            props,
            state,
            context,
          ); 
        }
      }
      currentFiber = currentFiber.return;
    }
    return context.extractEvents();
  },
};

export default RichEventsPlugin;
