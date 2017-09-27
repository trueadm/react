'use strict';

const React = require('React');
const PropTypes = require('prop-types');

function MyComponent(props) {
  const name = props.person !== undefined && props.person.name;

  return (
    <div>{name}</div>
  )
}
MyComponent.propTypes = {
  person: PropTypes.object,
};

module.exports = MyComponent;
