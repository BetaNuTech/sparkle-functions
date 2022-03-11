const post = require('./api/post');
const patch = require('./api/patch');
const onDelete = require('./api/delete');
const onDeleteWatcher = require('./watchers/on-delete');

module.exports = {
  api: { post, delete: onDelete, patch },
  watchers: { onDelete: onDeleteWatcher },
};
