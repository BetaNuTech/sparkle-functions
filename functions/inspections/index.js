const processWrite = require('./process-write');
const removeForProperty = require('./utils/remove-for-property');
const createOnWriteAttributeWatcher = require('./on-write-attribute-watcher');
const createOnWriteWatcher = require('./on-write-watcher');
const createOnDeleteWatcher = require('./on-delete-watcher');
const createOnGetPDFReportHandler = require('./on-get-pdf-report');
const getLatestCompleted = require('./get-latest-completed');
const createCleanupProxyOrphans = require('./pubsub/cleanup-proxy-orphans');
const createSyncPropertyInspectionProxies = require('./pubsub/sync-property-inspection-proxies');
const createSyncCompletedInspectionProxies = require('./pubsub/sync-completed-inspection-proxies');

module.exports = {
  processWrite,
  removeForProperty,
  getLatestCompleted,
  createOnWriteAttributeWatcher,
  createOnWriteWatcher,
  createOnDeleteWatcher,
  createOnGetPDFReportHandler,

  pubsub: {
    createCleanupProxyOrphans,
    createSyncPropertyInspectionProxies,
    createSyncCompletedInspectionProxies,
  },
};
