/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Flow type for SyntheticEvent class that includes private properties
 * @flow
 */

import type {Fiber} from 'react-reconciler/src/ReactFiber';
import type {EventPriority} from 'shared/ReactTypes';
import type {TopLevelType} from './TopLevelEventTypes';

export type DispatchConfig = {|
  dependencies?: Array<TopLevelType>,
  phasedRegistrationNames: {|
    bubbled: null | string,
    captured: null | string,
  |},
  registrationName?: string,
  eventPriority: EventPriority,
|};

export type CustomDispatchConfig = {|
  phasedRegistrationNames: {|
    bubbled: null,
    captured: null,
  |},
  customEvent: true,
|};

export type ReactSyntheticEventDispatchQueue = {|
  bubbled: Array<ReactSyntheticEventDispatchQueueItem>,
  captured: Array<ReactSyntheticEventDispatchQueueItem>,
|};

export type ReactSyntheticEventDispatchQueueItem = {|
  callback: Function,
  currentTarget: EventTarget,
  instance: Fiber | null,
|};

export type ReactSyntheticEvent = {|
  dispatchConfig: DispatchConfig | CustomDispatchConfig,
  getPooled: (
    dispatchConfig: DispatchConfig | CustomDispatchConfig,
    targetInst: Fiber,
    nativeTarget: Event,
    nativeEventTarget: EventTarget,
  ) => ReactSyntheticEvent,
  isPersistent: () => boolean,
  _targetInst: Fiber,
  type: string,
  isPropagationStopped: () => boolean,
|};
