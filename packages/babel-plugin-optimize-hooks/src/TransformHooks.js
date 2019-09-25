/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

module.exports = function helper(babel, opts) {
  const {types: t} = babel;

  function visitName(path, state, name, read, write): void {
    // Is the name bound to some local identifier? If so, we don't need to do anything
    if (path.scope.hasBinding(name, /*noGlobals*/ true)) {
      return;
    }
    // Otherwise, let's record that there's an unbound identifier
    if (read) {
      state.unboundReads.add(name);
    }
    if (write) {
      state.unboundWrites.add(name);
    }
  }

  function ignorePath(path) {
    let parent = path.parent;
    return (
      t.isLabeledStatement(parent) ||
      t.isBreakStatement(parent) ||
      t.isContinueStatement(parent)
    );
  }

  function getLeakedBindings(func) {
    const unboundReads = new Set();
    const unboundWrites = new Set();

    func.traverse(
      {
        ReferencedIdentifier(path, state) {
          if (ignorePath(path)) {
            return;
          }

          let innerName = path.node.name;
          if (innerName === 'arguments') {
            return;
          }
          visitName(path, state, innerName, true, false);
        },
        'AssignmentExpression|UpdateExpression'(path, state) {
          let doesRead = path.node.operator !== '=';
          for (let name in path.getBindingIdentifiers()) {
            visitName(path, state, name, doesRead, true);
          }
        },
      },
      {
        unboundReads,
        unboundWrites,
      },
    );

    return Array.from(unboundReads);
  }

  function optimizeUseEffect(path) {
    const args = path.get('arguments');
    const func = args[0];

    if (func) {
      const bindings = getLeakedBindings(func);
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];

        debugger;
      }
      func.hoist();
    }
  }

  function isUseEffectHook(path) {
    const callee = path.get('callee');
    const node = callee.node;
    return t.isIdentifier(callee) && node.name === 'useEffect';
  }

  return {
    name: 'transform-optimize-hooks',
    visitor: {
      CallExpression(path, state) {
        if (isUseEffectHook(path)) {
          optimizeUseEffect(path);
        }
      },
    },
  };
};
