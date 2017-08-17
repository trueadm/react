'use strict';

require('React');

function Benchmark2(props) {
  if (props.x === 100) {
    return <div>123</div>;
  } else {
    return <div>456</div>;
  }
}

var PowerEditor = Benchmark2;

module.exports = PowerEditor;
