const createSyncOutdated = require('./pubsub/sync-outdated');
const createOnWriteRealtime = require('./watchers/on-write-realtime');

module.exports = {
  pubsub: { createSyncOutdated },
  watchers: { createOnWriteRealtime },
};
