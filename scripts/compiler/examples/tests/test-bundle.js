(function () {
  "use strict";

  var _$3 = this;

  var _0 = function ({
    person,
    branch
  }: {
    person: {
      title: string
    };
    branch: boolean;
  }) {
    var _$0 = person;
    var _$1 = branch;

    if (_$1) {
      var _$2 = person.title;
    }

    return <div>{_$1 ? <span>The title is {_$2}</span> : <div>Hello world</div>}</div>;
  };

  var _1 = function (props) {
    return props.branch ? <span>The title is {props.person.title.toString()}</span> : <div>Hello world</div>;
  };

  _$3.test = _0;
}).call(this);