const createOnWriteWatcher = require('./on-write-watcher');
const createOnDeleteWatcher = require('./on-delete-watcher');
const createOnWriteTemplatesWatcher = require('./on-write-templates-watcher');
const createOnWriteTeamsWatcher = require('./on-write-team-watcher');
const getPropertyYardiResidents = require('./api/get-property-yardi-residents');
const getPropertyYardiWorkOrders = require('./api/get-property-yardi-work-orders');
const createSyncMeta = require('./pubsub/sync-meta');
const propertyCode = require('./middleware/property-code');
const yardiIntegration = require('./middleware/yardi-integration');
const processMeta = require('./utils/process-meta');

module.exports = {
  createOnDeleteWatcher,
  createOnWriteWatcher,
  createOnWriteTemplatesWatcher,
  createOnWriteTeamsWatcher,
  pubsub: { createSyncMeta },
  api: { getPropertyYardiResidents, getPropertyYardiWorkOrders },
  middleware: { propertyCode, yardiIntegration },
  utils: { processMeta },
};
