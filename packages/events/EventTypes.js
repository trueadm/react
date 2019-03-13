/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import SyntheticEvent from 'events/SyntheticEvent';
import type {AnyNativeEvent} from 'events/PluginModuleType';

export type EventContext = {
  eventTarget: EventTarget,
  eventType: string,
  nativeEvent: AnyNativeEvent,
  isPassive: boolean,
  isTargetWithinElement: (
    childTarget: EventTarget,
    parentTarget: EventTarget,
  ) => boolean,
  isTargetOwned: EventTarget => boolean,
  isTargetWithinEvent: EventTarget => boolean,
  isPositionWithinHitSlop: (x: number, y: number) => boolean,
  addRootEventTypes: (rootEventTypes: Array<string>) => void,
  removeRootEventTypes: (rootEventTypes: Array<string>) => void,
  dispatchBubbledEvent: (
    name: string,
    listener: (e: SyntheticEvent) => void | null,
    pressTarget: EventTarget | null,
    eventData?: Object,
  ) => void,
  dispatchImmediateEvent: (
    name: string,
    listener: (e: SyntheticEvent) => void | null,
    pressTarget: EventTarget | null,
    eventData?: Object,
  ) => void,
  requestOwnership: (target: EventTarget | null) => boolean,
  releaseOwnership: (target: EventTarget | null) => boolean,
};
