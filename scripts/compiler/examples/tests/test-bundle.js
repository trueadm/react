(function () {
  "use strict";

  var _$1 = this;

  var _0 = function (props: {
    foo: string
  }) {
    var _$0 = props.foo;
    return <div><span>The title is {_$0}</span></div>;
  };

  var _1 = function (props) {
    let x = props.title;
    return <span>The title is {x}</span>;
  };

  _$1.test = _0;
}).call(this);