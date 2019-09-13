const createOnWriteWatcher = require('./on-write-watcher');
const createOnDeleteWatcher = require('./on-delete-watcher');
const createOnWriteTemplatesWatcher = require('./on-write-templates-watcher');
const createOnWriteTeamsWatcher = require('./on-write-team-watcher');
const createSyncMeta = require('./pubsub/sync-meta');

module.exports = {
  createOnDeleteWatcher,
  createOnWriteWatcher,
  createOnWriteTemplatesWatcher,
  createOnWriteTeamsWatcher,
  pubsub: { createSyncMeta },
};
