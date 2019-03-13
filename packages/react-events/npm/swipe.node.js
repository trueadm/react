'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react-events-swipe.node.production.min.js');
} else {
  module.exports = require('./cjs/react-events-swipe.node.development.js');
}
