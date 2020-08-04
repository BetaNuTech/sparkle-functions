const postAuth = require('./api/post-auth');
const deleteAuth = require('./api/delete-auth');
const postEventsWebhook = require('./api/post-events-webhook');

module.exports = {
  api: {
    postAuth,
    deleteAuth,
    postEventsWebhook,
  },
};
