const onCreate = require('./on-create-v2');
const createCleanup = require('./pubsub/cleanup');
const cleanPublished = require('./pubsub/clean-published-v2');
const createPublishSlack = require('./pubsub/publish-slack');
const createPublishPush = require('./pubsub/publish-push');
const publishSlack = require('./pubsub/publish-slack-v2');
const publishPush = require('./pubsub/publish-push-v2');

module.exports = {
  onCreate,

  pubsub: {
    createCleanup,
    cleanPublished,
    createPublishSlack,
    createPublishPush,
    publishSlack,
    publishPush,
  },
};
