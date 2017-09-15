/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
'use strict';

module.exports = async function(src: string) {
  // Put the real compilation call here
  await Promise.resolve();
  return src;
  // Uncomment to see a failure:
  // return src.replace('World', 'Dominic');
};
