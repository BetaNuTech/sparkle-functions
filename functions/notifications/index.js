const createOnCreateSrcSlackWatcher = require('./on-create-src-slack-watcher');
const createOnCreateSrcPushWatcher = require('./on-create-src-push-watcher');
const createCleanup = require('./pubsub/cleanup');
const createPublishSlack = require('./pubsub/publish-slack');
const createPublishPush = require('./pubsub/publish-push');

module.exports = {
  createOnCreateSrcSlackWatcher,
  createOnCreateSrcPushWatcher,

  pubsub: {
    createCleanup,
    createPublishSlack,
    createPublishPush,
  },
};
