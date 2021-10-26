const post = require('./api/post');
const patch = require('./api/patch');
const onDelete = require('./api/delete');
const onDeleteV2 = require('./on-delete-v2');

module.exports = {
  api: { post, patch, delete: onDelete },
  onDeleteV2,
};
