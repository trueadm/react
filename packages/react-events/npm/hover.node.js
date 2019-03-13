'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react-events-hover.node.production.min.js');
} else {
  module.exports = require('./cjs/react-events-hover.node.development.js');
}
