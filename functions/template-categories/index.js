const post = require('./api/post');
const onDelete = require('./api/delete');
const onDeleteWatcher = require('./watchers/on-delete');

module.exports = {
  api: { post, delete: onDelete },
  watchers: { onDelete: onDeleteWatcher },
};
