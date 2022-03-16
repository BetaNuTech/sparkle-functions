const post = require('./api/post');
const patch = require('./api/patch');
const createDelete = require('./api/delete');

module.exports = {
  api: {
    post,
    patch,
    delete: createDelete,
  },
};
