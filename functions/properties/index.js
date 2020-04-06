const createOnWriteWatcher = require('./on-write-watcher');
const createOnDeleteWatcher = require('./on-delete-watcher');
const createOnWriteTemplatesWatcher = require('./on-write-templates-watcher');
const createOnWriteTeamsWatcher = require('./on-write-team-watcher');
const getPropertyYardiResidents = require('./api/get-property-yardi-residents');
const createSyncMeta = require('./pubsub/sync-meta');

module.exports = {
  createOnDeleteWatcher,
  createOnWriteWatcher,
  createOnWriteTemplatesWatcher,
  createOnWriteTeamsWatcher,
  pubsub: { createSyncMeta },
  api: { getPropertyYardiResidents },
};
