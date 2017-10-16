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
  return props.branch ? <span>The title is {props.person.title.toString()}</span> : <div>Hello world</div>;
}

function Test({person, branch}: {person: {title: string}, branch: boolean}) {
  return <div><Controller person={person} branch={branch} /></div>
}

__registerReactComponentRoot(Test);

global.test = Test;
