'use strict';

var React = require('React');

class App extends React.Component {
  constructor(props) {
    super(props);
    this.sum_ctorMessage = `A.ctor(${this.props.arg * 10})`;
    this.bkn_ctorMessage = `B.ctor(${this.props.arg * 100})`;
  }

  componentWillMount() {
    this.props.log.push(this.sum_ctorMessage);this.props.log.push(`A.componentWillMount(${this.props.arg * 10})`);this.props.log.push(this.bkn_ctorMessage);this.props.log.push(`B.componentWillMount(${this.props.arg * 100})`);
  }

  componentWillReceiveProps(nextProps) {
    this.sum_crwpMessage = `A.componentWillReceiveProps(${(this.props.arg * 10, nextProps.arg * 10)})`;this.bkn_crwpMessage = `B.componentWillReceiveProps(${(this.props.arg * 100, nextProps.arg * 100)})`;
  }

  componentWillUpdate(nextProps) {
    this.props.log.push(this.sum_crwpMessage);this.props.log.push(`A.componentWillUpdate(${this.props.arg * 10}, ${nextProps.arg * 10})`);this.props.log.push(this.bkn_crwpMessage);this.props.log.push(`B.componentWillUpdate(${this.props.arg * 100}, ${nextProps.arg * 100})`);
  }

  componentDidUpdate(prevProps) {
    this.props.log.push(`A.componentDidUpdate(${prevProps.arg * 10}, ${this.props.arg * 10})`);this.props.log.push(`B.componentDidUpdate(${prevProps.arg * 100}, ${this.props.arg * 100})`);
  }

  componentWillUnmount() {
    this.props.log.push(`A.componentWillUnmount(${this.props.arg * 10})`);this.props.log.push(`B.componentWillUnmount(${this.props.arg * 100})`);
  }

  componentDidMount() {
    this.props.log.push(`A.componentDidMount(${this.props.arg * 10})`);this.props.log.push(`B.componentDidMount(${this.props.arg * 100})`);
  }

  render() {
    return <div>{this.props.arg * 10}{this.props.arg * 100}</div>;
  }

}

var test = App;

var testBundle = test;

module.exports = testBundle;
