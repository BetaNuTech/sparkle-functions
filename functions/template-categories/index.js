const post = require('./api/post');
const onDelete = require('./watchers/on-delete');

module.exports = {
  api: { post },
  watchers: { onDelete },
};
