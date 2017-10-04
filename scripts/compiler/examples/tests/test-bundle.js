(function () {
  "use strict";

  var $$0 = {
    enumerable: false,
    configurable: true,
    writable: false
  };
  var $$1 = {
    enumerable: false,
    configurable: false,
    writable: false
  };
  var $$2 = {
    enumerable: false,
    configurable: true,
    writable: true
  };

  var _$0 = this;

  var _$1 = _$0.module;
  var _$2 = _$0.Object;
  var _$3 = _$2.defineProperty;
  var _$4 = _$0.React;
  var _$5 = _$4.Component;
  var _$6 = _$5.prototype;
  var _$7 = _$2.setPrototypeOf;
  var _$8 = _$0.Generator;
  var _$9 = _$8.prototype;

  var _2 = function (props) {
    var _f = props.x;
    var _e = ["Hello ", _f];

    var _d = <div>{_e}</div>;

    return _d;
  };

  var _3 = function () {
    var _g = <div>World</div>;

    return _g;
  };

  var _4 = function (...args) {
    super(...args);
  };

  var _7 = function () {
    return <div>!</div>;
  };

  var _1 = function () {
    var _k = ["Hello ", 42];

    var _j = <div>{_k}</div>;

    var _l = <div>World</div>;

    var _m = <_4 />;

    var _i = [_j, _l, _m];

    var _h = <div>{_i}</div>;

    return _h;
  };

  var _9 = function (renderer, Root) {
    renderer.update(<Root />);
    yield ['simple render', renderer.toJSON()];
  };

  var _b = _9.prototype;

  var __constructor = function () {};

  var _0 = _$1;
  $$0.value = 1, _$3(_4, "length", $$0);
  var _6 = _$6;

  var _5 = (__constructor.prototype = _6, new __constructor());

  $$2.value = _4, _$3(_5, "constructor", $$2);
  $$2.value = _7, _$3(_5, "render", $$2);

  if (_5.__proto__ !== _6) {
    throw new Error("unexpected prototype");
  }

  $$1.value = _5, _$3(_4, "prototype", $$1);
  var _8 = _$5;

  _$7(_4, _8);

  var _a = _$8;

  _$7(_9, _a);

  var _c = _$9;

  _$7(_b, _c);

  _1.getTrials = _9;
  _0.exports = _1;
}).call(this);