
const React = require('React');

var {doSomething, checkSomething} = require('someLib');

const foo = () => {

};

function makeThingsBad() {
  doSomething = null;
}

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
          Age: {doSomething(props.person.age)}
          Name: {fixName(props.person.title)}
        </p>
        <Button onClick={props.events.handleShowClick}>Show</Button>
      </div>
    );
	}
	return <Button onClick={props.events.handleCloseClick}>Cancel</Button>;
}

module.exports = MyComponent;
