/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
'use strict';

const externalFunction = require('ExternalModule');

type AppProps = {
  externalFunction: Function
};

const Bar = function (props: {number: number}) {
  return <span>{props.number}</span>;
};
Bar.defaultProps = {
  number: 123,
};

const Foo = () => <Bar />;

function App(props: AppProps) {
  var test = props.externalFunction();
  return (
    <div>
      {test}
      <Foo />
    </div>
  );
}

module.exports = App;
