(function () {
  "use strict";

  var _$0 = this;

  var _$1 = _$0.module;
  var _$2 = require('react').Component;

  var _3 = function (props) {
    var _a = props.x;
    var _9 = ["Hello ", _a];

    var _8 = <div>{_9}</div>;

    return _8;
  };

  var _4 = function () {
    var _b = <div>World</div>;

    return _b;
  };

  var _1 = function () {
    var _f = ["Hello ", 42];

    var _e = <div>{_f}</div>;

    var _g = <div>World</div>;

    var _h = <_5 />;

    var _i = <_7 />;

    var _d = [_e, _g, _h, _i];

    var _c = <div>{_d}</div>;

    return _c;
  };

  var _0 = _$1;

  var _2 = class {
    foo() {}

  };

  var _6 = _$2;

  var _5 = class extends _6 {
    constructor() {
      super();
      this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {}

    render() {
      return <div onClick={this.handleClick}>!</div>;
    }

  };

  var _7 = class extends _6 {
    constructor() {
      super();
      this.handleClick = this.handleClick.bind(this);
    }

    handleClick(e) {}

    render() {
      return <div onClick={this.handleClick}>!</div>;
    }

  };

  _0.exports = _1;
}).call(this);