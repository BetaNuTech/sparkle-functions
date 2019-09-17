const createOnCreateSrcSlackWatcher = require('./on-create-src-slack-watcher');
const createPublishSlackNotifications = require('./pubsub/publish-slack-notifications');

module.exports = {
  createOnCreateSrcSlackWatcher,

  pubsub: { createPublishSlackNotifications },
};
