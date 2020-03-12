/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from 'react-reconciler/src/ReactFiber';
import type {ReactSyntheticEvent} from 'legacy-events/ReactSyntheticEventType';

import getListener from 'legacy-events/getListener';
import {HostComponent} from 'shared/ReactWorkTags';

import {traverseEnterLeave} from 'shared/ReactTreeTraversal';
import accumulateInto from './accumulateInto';
import forEachAccumulated from './forEachAccumulated';

/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing even a
 * single one.
 */

/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
function accumulateDispatches(
  inst: Fiber,
  ignoredDirection: ?boolean,
  event: ReactSyntheticEvent,
): void {
  if (inst && event && event.dispatchConfig.registrationName) {
    const registrationName = event.dispatchConfig.registrationName;
    const listener = getListener(inst, registrationName);
    if (listener) {
      event._dispatchListeners = accumulateInto(
        event._dispatchListeners,
        listener,
      );
      event._dispatchInstances = accumulateInto(event._dispatchInstances, inst);
    }
  }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
function accumulateDirectDispatchesSingle(event: ReactSyntheticEvent) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event._targetInst, null, event);
  }
}

export function accumulateEnterLeaveDispatches(
  leave: ReactSyntheticEvent,
  enter: ReactSyntheticEvent,
  from: Fiber,
  to: Fiber,
) {
  traverseEnterLeave(from, to, accumulateDispatches, leave, enter);
}

export function accumulateDirectDispatches(
  events: ?(Array<ReactSyntheticEvent> | ReactSyntheticEvent),
) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}

export function accumulateTwoPhaseDispatches(
  event: ReactSyntheticEvent,
  skipTarget?: boolean,
): void {
  const phasedRegistrationNames = event.dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames == null) {
    return;
  }
  const {bubbled, captured} = phasedRegistrationNames;
  const dispatchListeners = [];
  const dispatchInstances = [];
  let node = event._targetInst;

  // If we skip the target, then start the node at the parent
  // of the target.
  if (skipTarget) {
    node = node.return;
  }

  // Accumulate all instances and listeners via the target -> root path.
  while (node !== null) {
    // We only care for listeners that are on HostComponents (i.e. <div>)
    if (node.tag === HostComponent) {
      // Standard React on* listeners, i.e. onClick prop
      const captureListener = getListener(node, captured);
      if (captureListener != null) {
        // Capture listeners/instances should go at the start, so we
        // unshift them to the start of the array.
        dispatchListeners.unshift(captureListener);
        dispatchInstances.unshift(node);
      }
      const bubbleListener = getListener(node, bubbled);
      if (bubbleListener != null) {
        // Bubble listeners/instances should go at the end, so we
        // push them to the end of the array.
        dispatchListeners.push(bubbleListener);
        dispatchInstances.push(node);
      }
    }
    node = node.return;
  }
  // To prevent allocation to the event unless we actually
  // have listeners we check the length of one of the arrays.
  if (dispatchListeners.length > 0) {
    event._dispatchListeners = dispatchListeners;
    event._dispatchInstances = dispatchInstances;
  }
}
