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

const babel = require('babel-core');
const fs = require('fs');
const path = require('path');
const React = require('ReactEntry');
const ReactTestRenderer = require('ReactTestRendererFiberEntry');
const transform = require('./transform');

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

function getOutput(Root) {
  const renderer = ReactTestRenderer.create(<Root />);
  // TODO: test updates, unmounting too
  return renderer.toJSON();
}

async function runFixture(name) {
  const src = fs.readFileSync(path.join(__dirname, name)).toString();
  const transformed = await transform(src);

  const After = runSource(transformed);
  expect(typeof After).toBe('function');

  const Before = runSource(src);
  expect(typeof Before).toBe('function');

  expect(getOutput(After)).toEqual(getOutput(Before));
}

describe('Compiler', () => {
  it('does something', async () => {
    await runFixture('fixtures/simple.js');
  });
});
