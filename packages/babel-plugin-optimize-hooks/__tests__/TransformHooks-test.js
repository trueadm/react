/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
/* eslint-disable quotes */
'use strict';

const babel = require('@babel/core');
const {wrap} = require('jest-snapshot-serializer-raw');

function transform(input, options) {
  return wrap(
    babel.transform(input, {
      configFile: false,
      plugins: [
        '@babel/plugin-syntax-jsx',
        '@babel/plugin-transform-arrow-functions',
        ...(options && options.development
          ? [
              '@babel/plugin-transform-react-jsx-source',
              '@babel/plugin-transform-react-jsx-self',
            ]
          : []),
        [
          './packages/babel-plugin-optimize-hooks',
          {
            development: __DEV__,
            ...options,
          },
        ],
      ],
    }).code
  );
}

describe('Optimize Hooks Plugin', () => {
  describe('useEffect', () => {
    it('should be hoisted', () => {
      const code = `
        import React, {useEffect} from 'react';
        
        function MyComponent(props) {
          useEffect(() => {
            console.log('works', props);
          });

          return null;
        }
      `;
      expect(transform(code)).toBe('');
    });
  });
});
