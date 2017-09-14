/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

function A() {
  return <div>Hello</div>;
}

function B() {
  return <div>World</div>;
}

function C() {
  return (
    <div>
      <A />
      <B />
    </div>
  );
}

module.exports = C;
