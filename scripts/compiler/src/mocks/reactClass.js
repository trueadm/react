"use strict";

const t = require('babel-types');

module.exports = t.classExpression(
  null,
  null,
  t.classBody([
    t.classMethod(
      'constructor',
      t.identifier('constructor'),
      [t.identifier('props'), t.identifier('context')],
      t.blockStatement([
        // this.props = props
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('props')),
            t.identifier('props')
          )
        ),
        // this.context = context
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('context')),
            t.identifier('context')
          )
        ),
        // this.state = {}
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('state')),
            t.objectExpression([])
          )
        ),
        // this.ref = {}
        t.expressionStatement(
          t.assignmentExpression(
            '=',
            t.memberExpression(t.thisExpression(), t.identifier('refs')),
            t.objectExpression([])
          )
        ),
      ])
    ),
  ]),
  []
);
