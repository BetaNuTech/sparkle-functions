const createOnCreateSrcSlackWatcher = require('./on-create-src-slack-watcher');
const createOnCreateSrcPushWatcher = require('./on-create-src-push-watcher');
const onCreate = require('./on-create-v2');
const createCleanup = require('./pubsub/cleanup');
const createPublishSlack = require('./pubsub/publish-slack');
const createPublishPush = require('./pubsub/publish-push');
const publishSlack = require('./pubsub/publish-slack-v2');

module.exports = {
  onCreate,
  createOnCreateSrcSlackWatcher,
  createOnCreateSrcPushWatcher,

  pubsub: {
    createCleanup,
    createPublishSlack,
    createPublishPush,
    publishSlack,
  },
};
