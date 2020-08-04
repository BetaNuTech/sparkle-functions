const slackEventsApiHandler = require('./slack-events-api-handler');
const postAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');
const postEventsWebhook = require('./api/post-events-webhook');

module.exports = {
  slackEventsApiHandler,

  api: {
    postAuth,
    deleteAuth,
    postEventsWebhook,
  },
};
