/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

var React = require('react');

function MaybeShow(props) {
  if (props.show) {
    return props.children;
  }
  return null;
}

function Override(props) {
  var child = props.children;
  var shouldShow = props.overrideShow;
  return React.cloneElement(child, {
    show: shouldShow
  });
}

function App(props) {
  return (
    <Override overrideShow={props.show}>
      <MaybeShow show={true}>
        <h1>Hi</h1>
      </MaybeShow>
    </Override>
  );
}

App.getTrials = function*(renderer, Root) {
  renderer.update(<Root show={true} />);
  yield ['clone element (true)', renderer.toJSON()];

  renderer.update(<Root show={false} />);
  yield ['clone element (false)', renderer.toJSON()];
};

module.exports = App;
