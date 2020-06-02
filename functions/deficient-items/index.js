const createOnWriteInspection = require('./on-write-inspection-watcher');
const createOnUpdateState = require('./on-update-state-watcher');
const createOnUpdateStateV2 = require('./on-update-state-watcher-v2');
const createOnUpdateArchive = require('./on-update-archive-watcher');
const createOnUpdateArchiveV2 = require('./on-update-archive-watcher-v2');
const onUpdateProgressNote = require('./on-update-progress-note');
const createSyncOverdue = require('./pubsub/sync-overdue');

module.exports = {
  createOnWriteInspection,
  createOnUpdateState,
  createOnUpdateStateV2,
  createOnUpdateArchive,
  createOnUpdateArchiveV2,
  onUpdateProgressNote,
  pubsub: { createSyncOverdue },
};
