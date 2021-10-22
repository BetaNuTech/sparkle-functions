const post = require('./api/post');
const patch = require('./api/patch');
const onDeleteV2 = require('./on-delete-v2');

module.exports = {
  api: { post, patch },
  onDeleteV2,
};
