const post = require('./api/post');
const createDelete = require('./api/delete');

module.exports = {
  api: {
    post,
    delete: createDelete,
  },
};
