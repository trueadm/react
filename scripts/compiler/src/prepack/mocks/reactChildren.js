"use strict";

const babylon = require('babylon');

const reactChildrenOnlyCode = `
function (children) {
  return children;
}
`;

const reactChildrenOnly = babylon.parseExpression(reactChildrenOnlyCode, {
  plugins: ['flow'],
});

module.exports = {
	reactChildrenOnly,
};
