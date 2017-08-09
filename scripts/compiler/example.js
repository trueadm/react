
const React = require('React');
const staticThing = 'two!';
const something = false;

function Foo({ target, age }) {
  var x = 1;
  var y = 3;
  while (x < y * 2) {
    x++;
  }
  if (x !== target) {
    y = 0;
  }
  return <Bar className="hello" x={x} y={y} age={age} />;
}

function Bar({ className, x, y, age }) {
  return (
    <div className={className + ' world ' + staticThing}>
      X: {x}
      Y: <Baz age={age}>{y}</Baz>
    </div>
  );
}

class SoWhat extends React.Component {
  constructor(props) {
    this.state = {
      name: 'Dan',
      age: props.age,
    }
  }
  render() {
    if (condition) {
      return <span>{this.state.age}{condition}</span>;
    } else {
      return <div>{this._renderHeader()}{condition}</div>;
    }
  }
  _renderHeader() {
    return <div>Header</div>
  }
  onComponentDidMount() {
    this.setState({
      name: 'Dan2',
    })
  }
}

function Baz({children, age}) {
  // Loops over abstract values are not supported.
  // Comment this out and see how the bailout mechanism works.
  // for (var i = 0; i < children; i++);
  return <span>{children}<SoWhat age={age} /></span>
}

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
