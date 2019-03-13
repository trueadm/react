/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {AnyNativeEvent} from 'events/PluginModuleType';
import type {Fiber} from 'react-reconciler/src/ReactFiber';
import type {DOMTopLevelEventType} from 'events/TopLevelEventTypes';

import {batchedUpdates, interactiveUpdates} from 'events/ReactGenericBatching';
import {runExtractedEventsInBatch} from 'events/EventPluginHub';
import {isFiberMounted} from 'react-reconciler/reflection';
import {HostRoot} from 'shared/ReactWorkTags';

import {addEventBubbleListener, addEventCaptureListener} from './EventListener';
import getEventTarget from './getEventTarget';
import {getClosestInstanceFromNode} from '../client/ReactDOMComponentTree';
import SimpleEventPlugin from './SimpleEventPlugin';
import {getRawEventName} from './DOMTopLevelEventTypes';
import {passiveBrowserEventsSupported} from './checkPassiveEvents';

const {isInteractiveTopLevelEventType} = SimpleEventPlugin;

const CALLBACK_BOOKKEEPING_POOL_SIZE = 10;
const callbackBookkeepingPool = [];

type BookKeepingInstance = {
  topLevelType: DOMTopLevelEventType | null,
  nativeEvent: AnyNativeEvent | null,
  targetInst: Fiber | null,
  ancestors: Array<Fiber | null>,
  passive: null | boolean,
};

/**
 * Find the deepest React component completely containing the root of the
 * passed-in instance (for use when entire React trees are nested within each
 * other). If React trees are not nested, returns null.
 */
function findRootContainerNode(inst) {
  // TODO: It may be a good idea to cache this to prevent unnecessary DOM
  // traversal, but caching is difficult to do correctly without using a
  // mutation observer to listen for all DOM changes.
  while (inst.return) {
    inst = inst.return;
  }
  if (inst.tag !== HostRoot) {
    // This can happen if we're in a detached tree.
    return null;
  }
  return inst.stateNode.containerInfo;
}

// Used to store ancestor hierarchy in top level callback
function getTopLevelCallbackBookKeeping(
  topLevelType: DOMTopLevelEventType,
  nativeEvent: AnyNativeEvent,
  targetInst: Fiber | null,
  passive: null | boolean,
): BookKeepingInstance {
  if (callbackBookkeepingPool.length) {
    const instance = callbackBookkeepingPool.pop();
    instance.topLevelType = topLevelType;
    instance.nativeEvent = nativeEvent;
    instance.targetInst = targetInst;
    instance.passive = passive;
    return instance;
  }
  return {
    topLevelType,
    nativeEvent,
    targetInst,
    ancestors: [],
    passive,
  };
}

function releaseTopLevelCallbackBookKeeping(
  instance: BookKeepingInstance,
): void {
  instance.topLevelType = null;
  instance.nativeEvent = null;
  instance.targetInst = null;
  instance.ancestors.length = 0;
  instance.passive = null;
  if (callbackBookkeepingPool.length < CALLBACK_BOOKKEEPING_POOL_SIZE) {
    callbackBookkeepingPool.push(instance);
  }
}

function handleTopLevel(bookKeeping: BookKeepingInstance) {
  let targetInst = bookKeeping.targetInst;

  // Loop through the hierarchy, in case there's any nested components.
  // It's important that we build the array of ancestors before calling any
  // event handlers, because event handlers can modify the DOM, leading to
  // inconsistencies with ReactMount's node cache. See #1105.
  let ancestor = targetInst;
  do {
    if (!ancestor) {
      const ancestors = bookKeeping.ancestors;
      ((ancestors: any): Array<Fiber | null>).push(ancestor);
      break;
    }
    const root = findRootContainerNode(ancestor);
    if (!root) {
      break;
    }
    bookKeeping.ancestors.push(ancestor);
    ancestor = getClosestInstanceFromNode(root);
  } while (ancestor);

  for (let i = 0; i < bookKeeping.ancestors.length; i++) {
    targetInst = bookKeeping.ancestors[i];
    runExtractedEventsInBatch(
      ((bookKeeping.topLevelType: any): DOMTopLevelEventType),
      targetInst,
      ((bookKeeping.nativeEvent: any): AnyNativeEvent),
      getEventTarget(bookKeeping.nativeEvent),
      bookKeeping.passive,
    );
  }
}

// TODO: can we stop exporting these?
export let _enabled = true;

export function setEnabled(enabled: ?boolean) {
  _enabled = !!enabled;
}

export function isEnabled() {
  return _enabled;
}

export function trapBubbledEvent(
  topLevelType: DOMTopLevelEventType,
  element: Document | Element | Node,
  isLegacy: boolean,
): void {
  const dispatch = isInteractiveTopLevelEventType(topLevelType)
    ? dispatchInteractiveEvent
    : dispatchEvent;
  const rawEventName = getRawEventName(topLevelType);

  trapEvent(element, topLevelType, dispatch, rawEventName, isLegacy);
}

export function trapCapturedEvent(
  topLevelType: DOMTopLevelEventType,
  element: Document | Element | Node,
  isLegacy: boolean,
): void {
  const dispatch = isInteractiveTopLevelEventType(topLevelType)
    ? dispatchInteractiveEvent
    : dispatchEvent;
  const rawEventName = getRawEventName(topLevelType);

  trapEvent(element, topLevelType, dispatch, rawEventName, isLegacy);
}

function trapEvent(
  element: Document | Element | Node,
  topLevelType: DOMTopLevelEventType,
  dispatch: (
    topLevelType: DOMTopLevelEventType,
    passive: null | boolean,
    nativeEvent: AnyNativeEvent,
  ) => void,
  rawEventName: string,
  isLegacy: boolean,
) {
  if (isLegacy) {
    // Check if interactive and wrap in interactiveUpdates
    const listener = dispatch.bind(null, topLevelType, null);
    // We don't listen for passive/non-passive
    addEventCaptureListener(element, rawEventName, listener, null);
  } else {
    if (passiveBrowserEventsSupported) {
      // Check if interactive and wrap in interactiveUpdates
      const activeListener = dispatch.bind(null, topLevelType, false);
      const passiveListener = dispatch.bind(null, topLevelType, true);
      // We listen to the same event for both passive/non-passive
      addEventCaptureListener(element, rawEventName, passiveListener, true);
      addEventCaptureListener(element, rawEventName, activeListener, false);
    } else {
      const fallbackListener = dispatch.bind(null, topLevelType, null);
      // We fallback if we can't use passive events to only using active behaviour,
      // except we pass through "false" as the passive flag to the dispatch function.
      // This ensures that legacy plugins do not incorrectly operate on the fired event
      // (they will only operate when "null" is on the passive flag).
      addEventCaptureListener(element, rawEventName, fallbackListener, false);
    }
  }
}

function dispatchInteractiveEvent(topLevelType, isPassiveEvent, nativeEvent) {
  interactiveUpdates(dispatchEvent, topLevelType, isPassiveEvent, nativeEvent);
}

export function dispatchEvent(
  topLevelType: DOMTopLevelEventType,
  // passive will be `null` for legacy events
  passive: null | boolean,
  nativeEvent: AnyNativeEvent,
): void {
  if (!_enabled) {
    return;
  }

  const nativeEventTarget = getEventTarget(nativeEvent);
  let targetInst = getClosestInstanceFromNode(nativeEventTarget);
  if (
    targetInst !== null &&
    typeof targetInst.tag === 'number' &&
    !isFiberMounted(targetInst)
  ) {
    // If we get an event (ex: img onload) before committing that
    // component's mount, ignore it for now (that is, treat it as if it was an
    // event on a non-React tree). We might also consider queueing events and
    // dispatching them after the mount.
    targetInst = null;
  }

  const bookKeeping = getTopLevelCallbackBookKeeping(
    topLevelType,
    nativeEvent,
    targetInst,
    passive,
  );

  try {
    // Event queue being processed in the same cycle allows
    // `preventDefault`.
    batchedUpdates(handleTopLevel, bookKeeping);
  } finally {
    releaseTopLevelCallbackBookKeeping(bookKeeping);
  }
}
