const createOnUpdateStateV2 = require('./on-update-state-watcher-v2');
const createOnUpdateArchive = require('./on-update-archive-watcher');
const createOnUpdateArchiveV2 = require('./on-update-archive-watcher-v2');
const onUpdateProgressNote = require('./on-update-progress-note');
const onUpdateProgressNoteV2 = require('./on-update-progress-note-v2');
const onUpdateCompletedPhotoV2 = require('./on-update-completed-photo-v2');
const trelloCardStateComment = require('./pubsub/trello-card-state-comment-v2');
const createSyncOverdue = require('./pubsub/sync-overdue');
const trelloCardClose = require('./pubsub/trello-card-close-v2');
const trelloCardDueDate = require('./pubsub/trello-card-due-date-v2');
const syncOverdue = require('./pubsub/sync-overdue-v2');

module.exports = {
  createOnUpdateStateV2,
  createOnUpdateArchive,
  createOnUpdateArchiveV2,
  onUpdateProgressNote,
  onUpdateProgressNoteV2,
  onUpdateCompletedPhotoV2,
  pubsub: {
    createSyncOverdue,
    trelloCardStateComment,
    trelloCardClose,
    trelloCardDueDate,
    syncOverdue,
  },
};
