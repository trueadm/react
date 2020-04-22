/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {AnyNativeEvent} from 'legacy-events/PluginModuleType';
import type {DOMTopLevelEventType} from 'legacy-events/TopLevelEventTypes';
import type {EventSystemFlags} from './EventSystemFlags';
import type {EventPriority, ReactScopeMethods} from 'shared/ReactTypes';
import type {Fiber} from 'react-reconciler/src/ReactInternalTypes';
import type {PluginModule} from 'legacy-events/PluginModuleType';
import type {ReactSyntheticEvent} from 'legacy-events/ReactSyntheticEventType';

import * as ReactDOMEventManger from 'react-dom-event-manager';

const {hasRegisteredEventOnContainer} = ReactDOMEventManger;

import {registrationNameDependencies} from 'legacy-events/EventPluginRegistry';
import {plugins} from 'legacy-events/EventPluginRegistry';
import {
  PLUGIN_EVENT_SYSTEM,
} from './EventSystemFlags';

import {
  HostComponent,
} from 'react-reconciler/src/ReactWorkTags';

import {
  addModernTrappedEventListener,
} from './ReactDOMEventListener';
import getEventTarget from './getEventTarget';
import {
  TOP_FOCUS,
  TOP_LOAD,
  TOP_ABORT,
  TOP_CANCEL,
  TOP_INVALID,
  TOP_BLUR,
  TOP_SCROLL,
  TOP_CLOSE,
  TOP_RESET,
  TOP_SUBMIT,
  TOP_CAN_PLAY,
  TOP_CAN_PLAY_THROUGH,
  TOP_DURATION_CHANGE,
  TOP_EMPTIED,
  TOP_ENCRYPTED,
  TOP_ENDED,
  TOP_ERROR,
  TOP_WAITING,
  TOP_VOLUME_CHANGE,
  TOP_TIME_UPDATE,
  TOP_SUSPEND,
  TOP_STALLED,
  TOP_SEEKING,
  TOP_SEEKED,
  TOP_PLAY,
  TOP_PAUSE,
  TOP_LOAD_START,
  TOP_LOADED_DATA,
  TOP_LOADED_METADATA,
  TOP_RATE_CHANGE,
  TOP_PROGRESS,
  TOP_PLAYING,
  TOP_CLICK,
  TOP_SELECTION_CHANGE,
  getRawEventName,
} from './DOMTopLevelEventTypes';
import {getClosestInstanceFromNode} from '../client/ReactDOMComponentTree';
import {COMMENT_NODE} from '../shared/HTMLNodeType';
import {batchedEventUpdates} from './ReactDOMUpdateBatching';
import getListener from './getListener';

import {enableLegacyFBSupport} from 'shared/ReactFeatureFlags';
import {
  invokeGuardedCallbackAndCatchFirstError,
  rethrowCaughtError,
} from 'shared/ReactErrorUtils';
import {eventNames} from 'cluster';

const capturePhaseEvents = new Set([
  TOP_FOCUS,
  TOP_BLUR,
  TOP_SCROLL,
  TOP_LOAD,
  TOP_ABORT,
  TOP_CANCEL,
  TOP_CLOSE,
  TOP_INVALID,
  TOP_RESET,
  TOP_SUBMIT,
  TOP_ABORT,
  TOP_CAN_PLAY,
  TOP_CAN_PLAY_THROUGH,
  TOP_DURATION_CHANGE,
  TOP_EMPTIED,
  TOP_ENCRYPTED,
  TOP_ENDED,
  TOP_ERROR,
  TOP_LOADED_DATA,
  TOP_LOADED_METADATA,
  TOP_LOAD_START,
  TOP_PAUSE,
  TOP_PLAY,
  TOP_PLAYING,
  TOP_PROGRESS,
  TOP_RATE_CHANGE,
  TOP_SEEKED,
  TOP_SEEKING,
  TOP_STALLED,
  TOP_SUSPEND,
  TOP_TIME_UPDATE,
  TOP_VOLUME_CHANGE,
  TOP_WAITING,
]);

const isArray = Array.isArray;

function executeDispatch(
  event: ReactSyntheticEvent,
  listener: Function,
  currentTarget: EventTarget,
): void {
  const type = event.type || 'unknown-event';
  event.currentTarget = currentTarget;
  invokeGuardedCallbackAndCatchFirstError(type, listener, undefined, event);
  event.currentTarget = null;
}

function executeDispatchesInOrder(event: ReactSyntheticEvent): void {
  // TODO we should remove _dispatchListeners and _dispatchInstances at some point.
  const dispatchListeners = event._dispatchListeners;
  const dispatchInstances = event._dispatchInstances;
  const dispatchCurrentTargets = event._dispatchCurrentTargets;
  let previousInstance;

  if (
    dispatchListeners !== null &&
    dispatchInstances !== null &&
    dispatchCurrentTargets !== null
  ) {
    for (let i = 0; i < dispatchListeners.length; i++) {
      const instance = dispatchInstances[i];
      const listener = dispatchListeners[i];
      const currentTarget = dispatchCurrentTargets[i];

      // We check if the instance was the same as the last one,
      // if it was, then we're still on the same instance thus
      // propagation should not stop. If we add support for
      // stopImmediatePropagation at some point, then we'll
      // need to handle that case here differently.
      if (instance !== previousInstance && event.isPropagationStopped()) {
        break;
      }
      // Listeners and Instances are two parallel arrays that are always in sync.
      executeDispatch(event, listener, currentTarget);
      previousInstance = instance;
    }
  }
  event._dispatchListeners = null;
  event._dispatchInstances = null;
  event._dispatchCurrentTargets = null;
}

export function dispatchEventsInBatch(
  events: Array<ReactSyntheticEvent>,
): void {
  for (let i = 0; i < events.length; i++) {
    const syntheticEvent = events[i];
    executeDispatchesInOrder(syntheticEvent);
    // Release the event from the pool if needed
    if (!syntheticEvent.isPersistent()) {
      syntheticEvent.constructor.release(syntheticEvent);
    }
  }
  // This would be a good time to rethrow if any of the event handlers threw.
  rethrowCaughtError();
}

function dispatchEventsForPlugins(
  topLevelType: DOMTopLevelEventType,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget,
): void {
  const nativeEventTarget = getEventTarget(nativeEvent);
  const syntheticEvents: Array<ReactSyntheticEvent> = [];

  for (let i = 0; i < plugins.length; i++) {
    const possiblePlugin: PluginModule<AnyNativeEvent> = plugins[i];
    const extractedEvents = possiblePlugin.extractEvents(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget,
      eventSystemFlags,
      targetContainer,
    );
    if (isArray(extractedEvents)) {
      // Flow complains about @@iterator being missing in ReactSyntheticEvent,
      // so we cast to avoid the Flow error.
      const arrOfExtractedEvents = ((extractedEvents: any): Array<ReactSyntheticEvent>);
      syntheticEvents.push(...arrOfExtractedEvents);
    } else if (extractedEvents != null) {
      syntheticEvents.push(extractedEvents);
    }
  }
  dispatchEventsInBatch(syntheticEvents);
}

export function listenToTopLevelEvent(
  topLevelType: DOMTopLevelEventType,
  targetContainer: EventTarget,
  eventSystemFlags: EventSystemFlags,
  passive?: boolean,
  priority?: EventPriority,
  capture?: boolean,
): void {
  const isCapturePhase =
    capture === undefined ? capturePhaseEvents.has(topLevelType) : capture;
  const eventName = getRawEventName(topLevelType);

  if (
    !hasRegisteredEventOnContainer(eventName, targetContainer, capture, passive)
  ) {
    addModernTrappedEventListener(
      targetContainer,
      topLevelType,
      eventSystemFlags,
      isCapturePhase,
      false,
      passive,
      priority,
    );
  }
}

export function listenToEvent(
  registrationName: string,
  rootContainerElement: Element,
): void {
  const dependencies = registrationNameDependencies[registrationName];

  for (let i = 0; i < dependencies.length; i++) {
    const dependency = dependencies[i];
    listenToTopLevelEvent(
      dependency,
      rootContainerElement,
      PLUGIN_EVENT_SYSTEM,
    );
  }
}

export function isManagedDOMElement(
  target: EventTarget | ReactScopeMethods,
): boolean {
  return getClosestInstanceFromNode(((target: any): Node)) !== null;
}

export function isValidEventTarget(
  target: EventTarget | ReactScopeMethods,
): boolean {
  return typeof (target: Object).addEventListener === 'function';
}

export function isReactScope(target: EventTarget | ReactScopeMethods): boolean {
  return typeof (target: Object).getChildContextValues === 'function';
}

export function dispatchEventForPluginEventSystem(
  topLevelType: DOMTopLevelEventType,
  eventSystemFlags: EventSystemFlags,
  nativeEvent: AnyNativeEvent,
  targetInst: null | Fiber,
  targetContainer: EventTarget,
): void {
  batchedEventUpdates(() =>
    dispatchEventsForPlugins(
      topLevelType,
      eventSystemFlags,
      nativeEvent,
      targetInst,
      targetContainer,
    ),
  );
}

export function accumulateTwoPhaseListeners(event: ReactSyntheticEvent): void {
  const phasedRegistrationNames = event.dispatchConfig.phasedRegistrationNames;
  const dispatchListeners = [];
  const dispatchInstances: Array<Fiber | null> = [];
  const dispatchCurrentTargets = [];

  const {bubbled, captured} = phasedRegistrationNames;
  // If we are not handling EventTarget only phase, then we're doing the
  // usual two phase accumulation using the React fiber tree to pick up
  // all relevant useEvent and on* prop events.
  let instance = event._targetInst;

  // Accumulate all instances and listeners via the target -> root path.
  while (instance !== null) {
    const {stateNode, tag} = instance;
    // Handle listeners that are on HostComponents (i.e. <div>)
    if (tag === HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      // Standard React on* listeners, i.e. onClick prop
      if (captured !== null) {
        const captureListener = getListener(instance, captured);
        if (captureListener != null) {
          // Capture listeners/instances should go at the start, so we
          // unshift them to the start of the array.
          dispatchListeners.unshift(captureListener);
          dispatchInstances.unshift(instance);
          dispatchCurrentTargets.unshift(currentTarget);
        }
      }
      if (bubbled !== null) {
        const bubbleListener = getListener(instance, bubbled);
        if (bubbleListener != null) {
          // Bubble listeners/instances should go at the end, so we
          // push them to the end of the array.
          dispatchListeners.push(bubbleListener);
          dispatchInstances.push(instance);
          dispatchCurrentTargets.push(currentTarget);
        }
      }
    }
    instance = instance.return;
  }

  // To prevent allocation to the event unless we actually
  // have listeners we check the length of one of the arrays.
  if (dispatchListeners.length > 0) {
    event._dispatchListeners = dispatchListeners;
    event._dispatchInstances = dispatchInstances;
    event._dispatchCurrentTargets = dispatchCurrentTargets;
  }
}

function getParent(inst: Fiber | null): Fiber | null {
  if (inst === null) {
    return null;
  }
  do {
    inst = inst.return;
    // TODO: If this is a HostRoot we might want to bail out.
    // That is depending on if we want nested subtrees (layers) to bubble
    // events to their parent. We could also go through parentNode on the
    // host node but that wouldn't work for React Native and doesn't let us
    // do the portal feature.
  } while (inst && inst.tag !== HostComponent);
  if (inst) {
    return inst;
  }
  return null;
}

/**
 * Return the lowest common ancestor of A and B, or null if they are in
 * different trees.
 */
function getLowestCommonAncestor(instA: Fiber, instB: Fiber): Fiber | null {
  let nodeA = instA;
  let nodeB = instB;
  let depthA = 0;
  for (let tempA = nodeA; tempA; tempA = getParent(tempA)) {
    depthA++;
  }
  let depthB = 0;
  for (let tempB = nodeB; tempB; tempB = getParent(tempB)) {
    depthB++;
  }

  // If A is deeper, crawl up.
  while (depthA - depthB > 0) {
    nodeA = getParent(nodeA);
    depthA--;
  }

  // If B is deeper, crawl up.
  while (depthB - depthA > 0) {
    nodeB = getParent(nodeB);
    depthB--;
  }

  // Walk in lockstep until we find a match.
  let depth = depthA;
  while (depth--) {
    if (nodeA === nodeB || (nodeB !== null && nodeA === nodeB.alternate)) {
      return nodeA;
    }
    nodeA = getParent(nodeA);
    nodeB = getParent(nodeB);
  }
  return null;
}

function accumulateEnterLeaveListenersForEvent(
  event: ReactSyntheticEvent,
  target: Fiber,
  common: Fiber | null,
  capture: boolean,
): void {
  const registrationName = event.dispatchConfig.registrationName;
  if (registrationName === undefined) {
    return;
  }
  const dispatchListeners = [];
  const dispatchInstances: Array<Fiber | null> = [];
  const dispatchCurrentTargets = [];

  let instance = target;
  while (instance !== null) {
    if (instance === common) {
      break;
    }
    const {alternate, stateNode, tag} = instance;
    if (alternate !== null && alternate === common) {
      break;
    }
    if (tag === HostComponent && stateNode !== null) {
      const currentTarget = stateNode;
      if (capture) {
        const captureListener = getListener(instance, registrationName);
        if (captureListener != null) {
          // Capture listeners/instances should go at the start, so we
          // unshift them to the start of the array.
          dispatchListeners.unshift(captureListener);
          dispatchInstances.unshift(instance);
          dispatchCurrentTargets.unshift(currentTarget);
        }
      } else {
        const bubbleListener = getListener(instance, registrationName);
        if (bubbleListener != null) {
          // Bubble listeners/instances should go at the end, so we
          // push them to the end of the array.
          dispatchListeners.push(bubbleListener);
          dispatchInstances.push(instance);
          dispatchCurrentTargets.push(currentTarget);
        }
      }
    }
    instance = instance.return;
  }
  // To prevent allocation to the event unless we actually
  // have listeners we check the length of one of the arrays.
  if (dispatchListeners.length > 0) {
    event._dispatchListeners = dispatchListeners;
    event._dispatchInstances = dispatchInstances;
    event._dispatchCurrentTargets = dispatchCurrentTargets;
  }
}

export function accumulateEnterLeaveListeners(
  leaveEvent: ReactSyntheticEvent,
  enterEvent: ReactSyntheticEvent,
  from: Fiber | null,
  to: Fiber | null,
): void {
  const common = from && to ? getLowestCommonAncestor(from, to) : null;

  if (from !== null) {
    accumulateEnterLeaveListenersForEvent(leaveEvent, from, common, false);
  }
  if (to !== null) {
    accumulateEnterLeaveListenersForEvent(enterEvent, to, common, true);
  }
}
