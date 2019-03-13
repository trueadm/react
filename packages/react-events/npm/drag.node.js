'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/react-events-drag.node.production.min.js');
} else {
  module.exports = require('./cjs/react-events-drag.node.development.js');
}
