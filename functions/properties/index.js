const onWriteV2 = require('./on-write-v2');
const onDeleteWatcherV2 = require('./on-delete-watcher-v2');
const createOnWriteTeamsWatcher = require('./on-write-team-watcher');
const getPropertyYardiResidents = require('./api/get-property-yardi-residents');
const getPropertyYardiWorkOrders = require('./api/get-property-yardi-work-orders');
const getLatestCompletedInspection = require('./api/get-latest-completed-inspection');
const createSyncMeta = require('./pubsub/sync-meta');
const propertyCode = require('./middleware/property-code');
const yardiIntegration = require('./middleware/yardi-integration');
const processMeta = require('./utils/process-meta');

module.exports = {
  onDeleteWatcherV2,
  onWriteV2,
  createOnWriteTeamsWatcher,
  pubsub: { createSyncMeta },
  api: {
    getPropertyYardiResidents,
    getPropertyYardiWorkOrders,
    getLatestCompletedInspection,
  },
  middleware: { propertyCode, yardiIntegration },
  utils: { processMeta },
};
