const createPostAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');
const getWorkspaces = require('./api/get-workspaces');
const getSpaces = require('./api/get-spaces');
const getLists = require('./api/get-lists');
const postDeficiencyTask = require('./api/post-deficiency-task');
const postJobTask = require('./api/post-job-task');
const putPropertyIntegration = require('./api/put-property-integration');
const deletePropertyIntegration = require('./api/delete-property-integration');

module.exports = {
  api: {
    postAuth: createPostAuth,
    deleteAuth,
    getWorkspaces,
    getSpaces,
    getLists,
    postDeficiencyTask,
    postJobTask,
    putPropertyIntegration,
    deletePropertyIntegration,
  },
};
