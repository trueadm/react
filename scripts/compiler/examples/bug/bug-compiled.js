'use strict';

require('React');
require('prop-types');

function MyComponent(props) {
  return <div>{this.props.person.name}</div>;
}

var bug = MyComponent;

var bugCompiled = bug;

module.exports = bugCompiled;
