"use strict";

const babylon = require('babylon');

const reduxCreateStoreCode = `
function (children) {
  return children;
}
`;

const reduxCreateStore = babylon.parseExpression(reduxCreateStoreCode, {
  plugins: ['flow'],
});

module.exports = {
	reduxCreateStore,
};
