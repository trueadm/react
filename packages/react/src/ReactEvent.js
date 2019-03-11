/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {REACT_EVENT_TYPE} from 'shared/ReactSymbols';
import type {ReactEvents} from 'shared/ReactTypes';
import warning from 'shared/warning';

let hasWarnedAboutBadResponderMap = false;

export function createEvent<A>(responderMap: A): ReactEvents {
  if (__DEV__) {
    if (!hasWarnedAboutBadResponderMap) {
      hasWarnedAboutBadResponderMap = true;
      warning(
        typeof responderMap === 'object' && responderMap !== null,
        'createEvent: Expected the first argument to be an an object ' +
          'mapping of props to responders. Instead received: %s',
        responderMap,
      );
    }
  }
  const responderSet = new Set();
  for (let key in responderMap) {
    const responder = responderMap[key];
    responderSet.add(responder);
  }
  return {
    $$typeof: REACT_EVENT_TYPE,
    defaultProps: null,
    responders: Array.from(responderSet),
    responderMap,
  };
}
