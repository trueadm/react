/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */


var React = require('React');

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
    return this.props.arg;
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
    return this.props.arg;
  }
}

function App(props) {
  return (
    <div>
      <A arg={props.arg * 10} log={props.log} />
      <B arg={props.arg * 100} log={props.log} />
    </div>
  );
}

module.exports = App;
