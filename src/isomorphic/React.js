/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

import {
  Component,
  PureComponent,
} from 'ReactBaseClasses';
import {
  map,
  forEach,
  count,
  toArray,
} from 'ReactChildren';
import {
  createElement,
  cloneElement,
  isValidElement,
} from 'ReactElement';
import ReactVersion from 'ReactVersion';
import onlyChild from 'onlyChild';

// DEV ONLY - needs stubbing
import ReactComponentTreeHook from 'ReactComponentTreeHook';
import ReactDebugCurrentFrame from 'ReactDebugCurrentFrame';
import ReactCurrentOwner from 'ReactCurrentOwner';

// this needs handling for DEV, but we've already imported them...
// import {
//   createElement,
//   createFactory,
//   cloneElement,
// } from 'ReactElementValidator';

const Children = {
  map,
  forEach,
  count,
  toArray,
  only: onlyChild,
};

export default {
  // Modern
  Children,
  Component,
  PureComponent,
  createElement,
  cloneElement,
  isValidElement,
  // Version
  version: ReactVersion,
  // Internals
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    ReactCurrentOwner,
    // These will be stubbed out in production
    ReactComponentTreeHook,
    ReactDebugCurrentFrame,
  },
};
