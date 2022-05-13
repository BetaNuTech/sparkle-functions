const postAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');
const getBoards = require('./api/get-boards');
const getBoardLists = require('./api/get-board-lists');
const postDeficiencyCard = require('./api/post-deficiency-card');
const postJobCard = require('./api/post-job-card');
const putPropertyIntegration = require('./api/put-property-integration');
const deletePropertyIntegration = require('./api/delete-property-integration');

module.exports = {
  api: {
    postAuth,
    deleteAuth,
    getBoards,
    getBoardLists,
    postDeficiencyCard,
    postJobCard,
    putPropertyIntegration,
    deletePropertyIntegration,
  },
};
