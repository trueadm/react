
const React = require('React');

var {doSomething, checkSomething} = require('someLib');

function Button() {
  return <span>123</span>
}

function fixName(name) {
  return name.toUpperCase();
}

function MyComponent(props) {
	if (checkSomething(props.age)) {
		return (
      <div>
        <p>
          Age: {doSomething(props.age)}
          Name: {fixName(props.title)}
        </p>
        <Button onClick={props.handleShowClick}>Show</Button>
      </div>
    );
	}
	return <Button onClick={props.handleCloseClick}>Cancel</Button>;
}

module.exports = MyComponent;
