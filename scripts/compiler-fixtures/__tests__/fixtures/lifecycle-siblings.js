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

var log = [];

class A extends React.Component {
  constructor(props) {
    super(props);
    log.push(`A.ctor(${this.props.arg})`);
  }
  componentWillMount() {
    log.push(`A.componentWillMount(${this.props.arg})`);
  }
  componentDidMount() {
    log.push(`A.componentDidMount(${this.props.arg})`);
  }
  componentWillUpdate(nextProps) {
    log.push(`A.componentDidUpdate(${this.props.arg}, ${nextProps.arg})`);
  }
  componentDidUpdate(prevProps) {
    log.push(`A.componentDidUpdate(${prevProps.arg}, ${this.props.arg})`);
  }
  componentWillUnmount() {
    log.push(`A.componentWillUnmount(${this.props.arg})`);
  }
  render() {
    return this.props.arg;
  }
}

class B extends React.Component {
  constructor(props) {
    super(props);
    log.push(`B.ctor(${this.props.arg})`);
  }
  componentWillMount() {
    log.push(`B.componentWillMount(${this.props.arg})`);
  }
  componentDidMount() {
    log.push(`B.componentDidMount(${this.props.arg})`);
  }
  componentWillUpdate(nextProps) {
    log.push(`B.componentDidUpdate(${this.props.arg}, ${nextProps.arg})`);
  }
  componentDidUpdate(prevProps) {
    log.push(`B.componentDidUpdate(${prevProps.arg}, ${this.props.arg})`);
  }
  componentWillUnmount() {
    log.push(`B.componentWillUnmount(${this.props.arg})`);
  }
  render() {
    return this.props.arg;
  }
}

function App(props) {
  return (
    <div>
      <A arg={props.arg * 10} />
      <B arg={props.arg * 100} />
    </div>
  );
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root arg={2} />);
  yield ['render 20 and 200 (render)', renderer.toJSON()];
  yield ['render 20 and 200 (log)', log];
  log.length = 0;
  renderer.update(<Root arg={3} />);
  yield ['render 30 and 300 (render)', renderer.toJSON()];
  yield ['render 30 and 300 (log)', log];
};

module.exports = App;
