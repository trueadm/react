/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const evaluator = require('./evaluator');
const reactClassMock = require('./mocks/reactClass');
const cloneElementMock = require('./mocks/cloneElement');
const reactChildrenMock = require('./mocks/reactChildren');
const reactReduxMock = require('./mocks/reactRedux');
const traverser = require("./traverser");
const {
  ObjectCreate,
  CreateDataPropertyOrThrow,
} = require('prepack/lib/methods');

function createMockReact(env) {
  const mockReact = evaluator.createAbstractObject('React');
  mockReact.$SetPartial('Component', env.eval(reactClassMock), mockReact);
  mockReact.$SetPartial('PureComponent', env.eval(reactClassMock), mockReact);
  mockReact.$SetPartial(
    'createElement',
    evaluator.createAbstractFunction('React.createElement'),
    mockReact
  );
  mockReact.$SetPartial('cloneElement', env.eval(cloneElementMock), mockReact);
  // mockReact.$SetPartial(
  //   'cloneElement',
  //   evaluator.createAbstractFunction('React.cloneElement'),
  //   mockReact
  // );
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

  const realm = evaluator.realm;
  const mockReactChildren = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
  mockReactChildren.$SetPartial(
    'only',
    env.eval(reactChildrenMock.reactChildrenOnly),
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

  mockReact.$Set('Children', mockReactChildren, mockReact);
  return mockReact;
}

function createMockWindow() {
  const realm = evaluator.realm;
  const windowObject = ObjectCreate(realm, realm.intrinsics.ObjectPrototype);
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

function createMockRedux(env) {
  const mockRedux = evaluator.createAbstractObject('Redux');
  mockRedux.$SetPartial('createStore', evaluator.createAbstractFunction('Redux.createStore'), mockRedux);
  return mockRedux;
}

function createMockReactRedux(env) {
  const mockReactRedux = evaluator.createAbstractObject('ReactRedux');
  mockReactRedux.$SetPartial('connect', evaluator.createAbstractFunction('ReactRedux.connect'), mockReactRedux);
  // mockReactRedux.$SetPartial('connect', env.eval(reactReduxMock.reactReduxConnect), mockReactRedux);
  return mockReactRedux;
}

function scanMocks(scope) {
  scope.deferredScopes = [];
  traverser.traverse(reactReduxMock.reactReduxConnect, traverser.Actions.ScanTopLevelScope, scope);
  scope.deferredScopes.map(deferredScope => deferredScope.scopeFunc());
}

module.exports = {
  createMockWindow,
  createMockReact,
  createMockRedux,
  createMockReactRedux,
  scanMocks,
};
