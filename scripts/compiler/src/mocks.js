"use strict";

const t = require("babel-types");
const babylon = require("babylon");

const cloneElementCode = `
function cloneElement(element, config, children) {
  var RESERVED_PROPS = {
    key: true,
    ref: true,
    __self: true,
    __source: true,
  };
  
  var propName;

  // Original props are copied
  var props = Object.assign({}, element.props);

  // Reserved names are extracted
  var key = element.key;
  var ref = element.ref;
  // Self is preserved since the owner is preserved.
  var self = element._self;
  // Source is preserved since cloneElement is unlikely to be targeted by a
  // transpiler, and the original source is probably a better indicator of the
  // true owner.
  var source = element._source;

  // Owner will be preserved, unless ref is overridden
  var owner = element._owner;

  if (config != null) {
    if (config.key !== null) {
      key = '' + config.key;
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return {
    // This tag allow us to uniquely identify this as a React Element
    $$typeof: element.$$typeof,

    // Built-in properties that belong on the element
    type: element.type,
    key: key,
    ref: ref,
    props: props,

    // Record the component responsible for creating this element.
    _owner: owner,
  };
}`;

const reactClass = t.classExpression(t.identifier('component'), null, t.classBody(
  [
    t.classMethod('constructor',
      t.identifier('constructor'),
      [t.identifier('props'), t.identifier('context')],
      t.blockStatement([
        // this.props = props
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('props')),
            t.identifier('props')
          )
        ),
        // this.context = context
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('context')),
            t.identifier('context')
          )
        ),
        // this.state = {}
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('state')),
            t.objectExpression([])
          )
        ),
        // this.ref = {}
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('refs')),
            t.objectExpression([])
          )
        )
      ])
    )
  ]
), []);

const cloneElement = babylon.parseExpression(cloneElementCode, {
  plugins: ["flow"],
});

function createMockReact() {
  return t.objectExpression(
    [
      t.objectProperty(t.identifier('Component'), reactClass),
      t.objectProperty(t.identifier('cloneElement'), cloneElement),
    ]
  );
}

module.exports = {
  createMockReact: createMockReact,
};
