'use strict';

const t = require('babel-types');
const babylon = require('babylon');
const evaluator = require('./evaluator');
const {
  ObjectCreate,
  CreateDataPropertyOrThrow,
} = require('prepack/lib/methods');

const reactClass = t.classExpression(
  t.identifier('component'),
  null,
  t.classBody([
    t.classMethod(
      'constructor',
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
        ),
      ])
    ),
  ]),
  []
);

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
    if (config.ref !== undefined) {
      // Silently steal the ref from the parent.
      ref = config.ref;
      if (typeof ref === 'string') {
        // throw new Error('Failed to inline component due to usage of string refs on cloneElement');
      }
    }
    if (config.key !== undefined) {
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

const reactChildrenOnlyCode = `
function (children) {
  return children;
}
`;

const cloneElement = babylon.parseExpression(cloneElementCode, {
  plugins: ['flow'],
});

const reactChildrenOnly = babylon.parseExpression(reactChildrenOnlyCode, {
  plugins: ['flow'],
});

function createMockReact(env) {
  const mockReact = evaluator.createAbstractObject('React');
  mockReact.$SetPartial('Component', env.eval(reactClass), mockReact);
  mockReact.$SetPartial('PureComponent', env.eval(reactClass), mockReact);
  mockReact.$SetPartial(
    'createElement',
    evaluator.createAbstractFunction('React.createElement'),
    mockReact
  );
  mockReact.$SetPartial('cloneElement', env.eval(cloneElement), mockReact);
  mockReact.$SetPartial(
    'isValidElement',
    evaluator.createAbstractFunction('React.isValidElement'),
    mockReact
  );
  mockReact.$SetPartial(
    'createFactory',
    evaluator.createAbstractFunction('React.createFactory'),
    mockReact
  );

  const mockReactChildren = evaluator.createAbstractObject('React.Children');
  mockReactChildren.$SetPartial(
    'only',
    env.eval(reactChildrenOnly),
    mockReactChildren
  );
  mockReactChildren.$SetPartial(
    'count',
    evaluator.createAbstractFunction('React.Children.count'),
    mockReactChildren
  );
  mockReactChildren.$SetPartial(
    'map',
    evaluator.createAbstractFunction('React.Children.map'),
    mockReactChildren
  );
  mockReactChildren.$SetPartial(
    'forEach',
    evaluator.createAbstractFunction('React.Children.forEach'),
    mockReactChildren
  );
  mockReactChildren.$SetPartial(
    'toArray',
    evaluator.createAbstractFunction('React.Children.toArray'),
    mockReactChildren
  );

  mockReact.$SetPartial('Children', mockReactChildren, mockReact);
  return mockReact;
}

function createMockWindow() {
  const realm = evaluator.realm;
  const windowObject = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  // const windowObject = evaluator.createObject('window');
  const locationObject = evaluator.createAbstractObject('window.location');
  locationObject.$SetPartial(
    'host',
    evaluator.createAbstractString('window.location.host'),
    locationObject
  );
  locationObject.$SetPartial(
    'protocol',
    evaluator.createAbstractString('window.location.protocol'),
    locationObject
  );
  CreateDataPropertyOrThrow(realm, windowObject, 'location', locationObject);
  return windowObject;
}

module.exports = {
  createMockWindow: createMockWindow,
  createMockReact: createMockReact,
};
