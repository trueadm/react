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

let hasWarnedAboutBadModules = false;

export function createEvent<A>(modules: A): ReactEvents {
  if (__DEV__) {
    if (!hasWarnedAboutBadModules) {
      hasWarnedAboutBadModules = true;
      warning(
        Array.isArray(modules) || (typeof modules === 'object' && modules !== null),
        'createEvent: Expected the first argument to be an event module ' +
          'or an array of event modules. Instead received: %s',
          modules,
      );
    }
  }
  return {
    $$typeof: REACT_EVENT_TYPE,
    current: null,
    modules,
  };
}
