/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const {
  createAbstractObject,
  createAbstractFunction,
  createAbstractString,
  realm,
  __object,
} = require('./prepack');
const reactClassMock = require('./mocks/reactClass');
const cloneElementMock = require('./mocks/cloneElement');
const reactChildrenMock = require('./mocks/reactChildren');
// const reactReduxMock = require('./mocks/reactRedux');
const {
  ObjectCreate,
  CreateDataPropertyOrThrow,
} = require('prepack/lib/methods');

function createMockReact(env) {
  return __object({
    Component: env.eval(reactClassMock),
  }, 'Component');
  // const mockReact = createAbstractObject('React');
  // mockReact.$SetPartial('Component', env.eval(reactClassMock), mockReact);
  // mockReact.$SetPartial('PureComponent', env.eval(reactClassMock), mockReact);
  // mockReact.$SetPartial(
  //   'createElement',
  //   createAbstractFunction('React.createElement'),
  //   mockReact
  // );
  // mockReact.$SetPartial('cloneElement', env.eval(cloneElementMock), mockReact);
  // // mockReact.$SetPartial(
  // //   'cloneElement',
  // //   evaluator.createAbstractFunction('React.cloneElement'),
  // //   mockReact
  // // );
  // mockReact.$SetPartial(
  //   'isValidElement',
  //   createAbstractFunction('React.isValidElement'),
  //   mockReact
  // );
  // mockReact.$SetPartial(
  //   'createFactory',
  //   createAbstractFunction('React.createFactory'),
  //   mockReact
  // );

  // const mockReactChildren = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  // mockReactChildren.$SetPartial(
  //   'only',
  //   env.eval(reactChildrenMock.reactChildrenOnly),
  //   mockReactChildren
  // );
  // mockReactChildren.$SetPartial(
  //   'count',
  //   createAbstractFunction('React.Children.count'),
  //   mockReactChildren
  // );
  // mockReactChildren.$SetPartial(
  //   'map',
  //   createAbstractFunction('React.Children.map'),
  //   mockReactChildren
  // );
  // mockReactChildren.$SetPartial(
  //   'forEach',
  //   createAbstractFunction('React.Children.forEach'),
  //   mockReactChildren
  // );
  // mockReactChildren.$SetPartial(
  //   'toArray',
  //   createAbstractFunction('React.Children.toArray'),
  //   mockReactChildren
  // );

  // mockReact.$Set('Children', mockReactChildren, mockReact);
  return mockReact;
}

function createMockWindow() {
  const windowObject = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  const locationObject = createAbstractObject('window.location');
  locationObject.$SetPartial(
    'host',
    createAbstractString('window.location.host'),
    locationObject
  );
  locationObject.$SetPartial(
    'protocol',
    createAbstractString('window.location.protocol'),
    locationObject
  );
  CreateDataPropertyOrThrow(realm, windowObject, 'location', locationObject);
  return windowObject;
}

function createMockRedux(env) {
  const mockRedux = createAbstractObject('Redux');
  mockRedux.$SetPartial('createStore', createAbstractFunction('Redux.createStore'), mockRedux);
  return mockRedux;
}

function createMockReactRedux(env) {
  const mockReactRedux = createAbstractObject('ReactRedux');
  mockReactRedux.$SetPartial('connect', createAbstractFunction('ReactRedux.connect'), mockReactRedux);
  // mockReactRedux.$SetPartial('connect', env.eval(reactReduxMock.reactReduxConnect), mockReactRedux);
  return mockReactRedux;
}

module.exports = {
  createMockWindow,
  createMockReact,
  createMockRedux,
  createMockReactRedux,
};
