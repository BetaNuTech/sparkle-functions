const postAuth = require('./api/post-auth');
const patchAuth = require('./api/patch-auth');
const deleteAuth = require('./api/delete-auth');
const postEventsWebhook = require('./api/post-events-webhook');

module.exports = {
  api: {
    postAuth,
    patchAuth,
    deleteAuth,
    postEventsWebhook,
  },
};
