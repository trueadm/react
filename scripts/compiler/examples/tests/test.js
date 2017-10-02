/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */


var React = require('React');
var Foo = require('Foo');

function foo() {
  return <span>123</span>;
}

function App(props: {check: boolean}) {
  function test(e) {
    e.log('123');
  }
  return props.check === true ? <div onClick={test}>{foo()}</div> : <div>Nothing</div>;
}

function App(props: {check?: boolean}) {
  if (props.check == null) {
    return 123;
  }
  return props.check === true ?  <div>123</div> : <div>Nothing</div>;
}

module.exports = App;
