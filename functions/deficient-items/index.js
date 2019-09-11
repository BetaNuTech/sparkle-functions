const createOnWriteInspection = require('./on-write-inspection-watcher');
const createOnUpdateState = require('./on-update-state-watcher');
const createOnUpdateArchive = require('./on-update-archive-watcher');
const cron = require('./cron');

module.exports = {
  createOnWriteInspection,
  createOnUpdateState,
  createOnUpdateArchive,
  cron,
};
