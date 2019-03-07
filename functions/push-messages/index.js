const co = require('co');
const log = require('../utils/logger');
const createOnWriteHandler = require('./on-write-handler');
const createCRONHandler = require('./cron-handler');

module.exports = {
  createCRONHandler,
  createOnWriteHandler
};
