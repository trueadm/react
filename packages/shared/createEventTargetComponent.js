/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * @flow
 */

import type {
  ReactEventTargetComponent,
  ReactEventTargetComponentMappings,
} from 'shared/ReactTypes';
import {REACT_EVENT_TARGET_COMPONENT_TYPE} from 'shared/ReactSymbols';

export default function createEventTargetComponent<Props>(
  type: string,
  mappings: ReactEventTargetComponentMappings<Props>,
): ReactEventTargetComponent<Props> {
  const eventTargetComponent = {
    $$typeof: REACT_EVENT_TARGET_COMPONENT_TYPE,
    mappings,
    type,
  };
  if (__DEV__) {
    Object.freeze(eventTargetComponent);
  }
  return eventTargetComponent;
}
