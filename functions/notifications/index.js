const createOnCreateSrcSlackWatcher = require('./on-create-src-slack-watcher');
const createCleanup = require('./pubsub/cleanup');
const createPublishSlack = require('./pubsub/publish-slack');

module.exports = {
  createOnCreateSrcSlackWatcher,

  pubsub: {
    createCleanup,
    createPublishSlack,
  },
};
