/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

function Controller(props) {
  let x = props.title;
  return <span>The title is {x}</span>;
}

function Test(props: { foo: string }) {
  return <div><Controller title={props.foo} /></div>
}

__registerReactComponentRoot(Test);

global.test = Test;
