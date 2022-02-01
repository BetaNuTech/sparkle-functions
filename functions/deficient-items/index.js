const createOnUpdateStateV2 = require('./on-update-state-watcher-v2');
const createOnUpdateArchiveV2 = require('./on-update-archive-watcher-v2');
const onUpdateProgressNoteV2 = require('./on-update-progress-note-v2');
const onUpdateCompletedPhotoV2 = require('./on-update-completed-photo-v2');
const trelloCardStateComment = require('./pubsub/trello-card-state-comment-v2');
const trelloCardClose = require('./pubsub/trello-card-close-v2');
const trelloCardDueDate = require('./pubsub/trello-card-due-date-v2');
const putBatch = require('./api/put-batch');
const postImage = require('./api/post-image');
const putBatchSetupMiddleware = require('./api/put-batch-setup-middleware');
const syncOverdue = require('./pubsub/sync-overdue-v2');

module.exports = {
  createOnUpdateStateV2,
  createOnUpdateArchiveV2,
  onUpdateProgressNoteV2,
  onUpdateCompletedPhotoV2,
  api: { putBatch, putBatchSetupMiddleware, postImage },
  pubsub: {
    trelloCardStateComment,
    trelloCardClose,
    trelloCardDueDate,
    syncOverdue,
  },
};
