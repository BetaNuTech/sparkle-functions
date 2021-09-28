const postAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');
const getBoards = require('./api/get-boards');
const getBoardLists = require('./api/get-board-lists');
const postDeficiencyCard = require('./api/post-deficiency-card');
const postJobCard = require('./api/post-job-card');

module.exports = {
  api: {
    postAuth,
    deleteAuth,
    getBoards,
    getBoardLists,
    postDeficiencyCard,
    postJobCard,
  },
};
