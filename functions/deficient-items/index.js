const createOnWriteInspection = require('./on-write-inspection-watcher');
const createOnUpdateState = require('./on-update-state-watcher');
const createOnUpdateArchive = require('./on-update-archive-watcher');
const createSyncOverdue = require('./pubsub/sync-overdue');

module.exports = {
  createOnWriteInspection,
  createOnUpdateState,
  createOnUpdateArchive,
  pubsub: { createSyncOverdue },
};
