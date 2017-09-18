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

class A extends React.Component {
  constructor(props) {
    super(props);
    this.props.log.push(`A.ctor(${this.props.arg})`);
  }
  componentWillMount() {
    this.props.log.push(`A.componentWillMount(${this.props.arg})`);
  }
  componentDidMount() {
    this.props.log.push(`A.componentDidMount(${this.props.arg})`);
  }
  componentWillUpdate(nextProps) {
    this.props.log.push(`A.componentDidUpdate(${this.props.arg}, ${nextProps.arg})`);
  }
  componentDidUpdate(prevProps) {
    this.props.log.push(`A.componentDidUpdate(${prevProps.arg}, ${this.props.arg})`);
  }
  componentWillUnmount() {
    this.props.log.push(`A.componentWillUnmount(${this.props.arg})`);
  }
  render() {
    return [
      this.props.arg,
      this.props.children
    ];
  }
}

class B extends React.Component {
  constructor(props) {
    super(props);
    this.props.log.push(`B.ctor(${this.props.arg})`);
  }
  componentWillMount() {
    this.props.log.push(`B.componentWillMount(${this.props.arg})`);
  }
  componentDidMount() {
    this.props.log.push(`B.componentDidMount(${this.props.arg})`);
  }
  componentWillUpdate(nextProps) {
    this.props.log.push(`B.componentDidUpdate(${this.props.arg}, ${nextProps.arg})`);
  }
  componentDidUpdate(prevProps) {
    this.props.log.push(`B.componentDidUpdate(${prevProps.arg}, ${this.props.arg})`);
  }
  componentWillUnmount() {
    this.props.log.push(`B.componentWillUnmount(${this.props.arg})`);
  }
  render() {
    return [
      this.props.arg,
      this.props.children
    ];
  }
}

function App(props) {
  const child = <B arg={props.arg * 100} log={props.log}>{props.arg}</B>;
  return <A arg={props.arg * 10} log={props.log}>{child}</A>;
}

App.getTrials = function*(renderer, Root) {
  const firstLog = [];
  renderer.update(<Root arg={2} log={firstLog} />);
  yield ['render 20 and 200 (render)', renderer.toJSON()];
  yield ['render 20 and 200 (log)', firstLog];

  const secondLog = [];
  renderer.update(<Root arg={3} log={secondLog} />);
  yield ['render 30 and 300 (render)', renderer.toJSON()];
  yield ['render 30 and 300 (log)', secondLog];
};

module.exports = App;
