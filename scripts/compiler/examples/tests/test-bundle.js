'use strict';

var React = require('React');

class App extends React.Component {
  constructor(props) {
    super(props);
    this.props.log.push(`A.ctor(${this.props.arg * 10})`);
    this.props.log.push(`B.ctor(${this.props.arg * 100})`);
  }

  componentWillMount() {
    this.props.log.push(`A.componentWillMount(${this.props.arg * 10})`);this.props.log.push(`B.componentWillMount(${this.props.arg * 100})`);
  }

  componentDidMount() {
    this.props.log.push(`A.componentDidMount(${this.props.arg * 10})`);this.props.log.push(`B.componentDidMount(${this.props.arg * 100})`);
  }

  componentWillUpdate(nextProps) {
    this.props.log.push(`A.componentDidUpdate(${this.props.arg * 10}, ${nextProps.arg * 10})`);this.props.log.push(`B.componentWillUpdate(${this.props.arg * 100}, ${nextProps.arg * 100})`);
  }

  componentDidUpdate(prevProps) {
    this.props.log.push(`A.componentDidUpdate(${prevProps.arg * 10}, ${this.props.arg * 10})`);this.props.log.push(`B.componentDidUpdate(${prevProps.arg * 100}, ${this.props.arg * 100})`);
  }

  componentWillUnmount() {
    this.props.log.push(`A.componentWillUnmount(${this.props.arg * 10})`);this.props.log.push(`B.componentWillUnmount(${this.props.arg * 100})`);
  }

  render() {
    return <div>
      {this.props.arg * 10}
      {this.props.arg * 100}
    </div>;
  }

}

var test = App;

var testBundle = test;

module.exports = testBundle;
