const createPatchUser = require('./api/patch-user');
const createPostUser = require('./api/post-user');
// const createDeleteUser = require('./api/delete-user');

module.exports = {
  api: {
    createPatchUser,
    createPostUser,
    // createDeleteUser,
  },
};
