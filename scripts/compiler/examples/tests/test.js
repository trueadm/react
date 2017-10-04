/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var React = require('react');

class C extends React.Component {
  constructor() {
    super();
    this.handleClick = this.handleClick.bind(this);
  }
  handleClick(e) {
    // do something
  }
  render() {
    return <div onClick={this.handleClick}>!</div>;
  }
}

class D extends React.Component {
  constructor() {
    super();
    this.handleClick = this.handleClick.bind(this);
  }
  handleClick(e) {
    // do something
  }
  render() {
    return <div onClick={this.handleClick}>!</div>;
  }
}


function A(props: {x: number}) {
  return <div>Hello {props.x}</div>;
}

function B() {
  return <div>World</div>;
}

class Lol {
  foo() {

  }
}

function App() {
  var lol = new Lol();
  return (
    <div>
      <A x={42} />
      <B />
      <C />
      <D />
    </div>
  );
}

module.exports = App;
