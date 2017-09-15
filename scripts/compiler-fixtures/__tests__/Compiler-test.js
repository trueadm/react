/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 */
'use strict';

let babel = require('babel-core');
let fs = require('fs');
let path = require('path');

let React;
let ReactTestRenderer;
let compile;

function runSource(code) {
  const codeAfterBabel = babel.transform(code, {
    presets: ['babel-preset-react'],
    plugins: ['transform-object-rest-spread'],
  }).code;
  const fn = new Function('React', 'module', codeAfterBabel);
  let module = {exports: null};
  fn(React, module);
  return module.exports;
}

async function runFixture(name) {
  const src = fs.readFileSync(path.join(__dirname, name)).toString();
  const {code: transformed, optimizedTrees} = await compile(src);

  const A = runSource(src);
  expect(typeof A).toBe('function');
  const B = runSource(transformed);
  expect(typeof B).toBe('function');

  const rendererA = ReactTestRenderer.create(null);
  const rendererB = ReactTestRenderer.create(null);

  // Use the original version of the test in case transforming messes it up.
  const {getTrials} = A;

  // Run tests that assert the rendered output matches.
  let trialsA = getTrials(rendererA, A);
  let trialsB = getTrials(rendererB, B);
  while (true) {
    const {value: valueA, done: doneA} = trialsA.next();
    const {value: valueB, done: doneB} = trialsB.next();
    expect(doneA).toBe(doneB);
    // The yielded output should be the same.
    // Each fixture gets to decide what to yield.
    expect(valueA).toEqual(valueB);
    if (doneA) {
      break;
    }
  }

  // This lets us catch unexpected bailouts
  expect(`Optimized ${optimizedTrees} trees`).toMatchSnapshot();
}

describe('Compiler', () => {
  // It appears the the compiler has shared state that breaks test isolation.
  beforeEach(() => {
    jest.resetModules();
    React = require('ReactEntry');
    ReactTestRenderer = require('ReactTestRendererFiberEntry');
    compile = require('../../compiler/index');
  });

  it('simple', async () => {
    await runFixture('fixtures/simple.js');
  });

  // Bug?
  xit('dynamic-props', async () => {
    await runFixture('fixtures/dynamic-props.js');
  });
});
