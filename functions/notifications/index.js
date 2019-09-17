const createOnCreateSrcSlackWatcher = require('./on-create-src-slack-watcher');
const createPublishSlack = require('./pubsub/publish-slack');

module.exports = {
  createOnCreateSrcSlackWatcher,

  pubsub: { createPublishSlack },
};
