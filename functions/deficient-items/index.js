const createOnWriteInspection = require('./on-write-inspection-watcher');
const createOnUpdateState = require('./on-update-state-watcher');
const createOnUpdateStateV2 = require('./on-update-state-watcher-v2');
const createOnUpdateArchive = require('./on-update-archive-watcher');
const createOnUpdateArchiveV2 = require('./on-update-archive-watcher-v2');
const onUpdateProgressNote = require('./on-update-progress-note');
const onUpdateProgressNoteV2 = require('./on-update-progress-note-v2');
const onUpdateCompletedPhotoV2 = require('./on-update-completed-photo-v2');
const createSyncOverdue = require('./pubsub/sync-overdue');

module.exports = {
  createOnWriteInspection,
  createOnUpdateState,
  createOnUpdateStateV2,
  createOnUpdateArchive,
  createOnUpdateArchiveV2,
  onUpdateProgressNote,
  onUpdateProgressNoteV2,
  onUpdateCompletedPhotoV2,
  pubsub: { createSyncOverdue },
};
