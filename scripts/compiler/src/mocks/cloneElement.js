/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
"use strict";

const babylon = require('babylon');

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

module.exports = babylon.parseExpression(cloneElementCode, {
  plugins: ['flow'],
});
