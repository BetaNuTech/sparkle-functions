const createOnSlackAppAuthHandler = require('./on-create-request-handler');
const createOnSlackNotificationHandler = require('./create-notification-record-handler');
const createDeleteSlackAppHandler = require('./delete-slack-app');
const createSlackEventsApiHandler = require('./create-slack-events-api-handler');
const postAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');

module.exports = {
  createOnSlackAppAuthHandler,
  createOnSlackNotificationHandler,
  createDeleteSlackAppHandler,
  createSlackEventsApiHandler,

  api: {
    postAuth,
    deleteAuth,
  },
};
