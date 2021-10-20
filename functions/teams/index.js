const post = require('./api/post');
const onDeleteV2 = require('./on-delete-v2');

module.exports = {
  api: { post },
  onDeleteV2,
};
