const createPatchUser = require('./api/patch');
const createPostUser = require('./api/post');
const createDeleteUser = require('./api/delete');

module.exports = {
  api: {
    createPatchUser,
    createPostUser,
    createDeleteUser,
  },
};
