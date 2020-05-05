const processWrite = require('./process-write');
const createOnWriteAttributeWatcher = require('./on-write-attribute-watcher');
const createOnDeleteWatcher = require('./on-delete-watcher');
const onCreateWatcher = require('./on-create-watcher');
const createOnGetPDFReportHandler = require('./on-get-pdf-report');
const getLatestCompleted = require('./get-latest-completed');
const createAPIPatchProperty = require('./api/patch-property');
const createCleanupProxyOrphans = require('./pubsub/cleanup-proxy-orphans');
const createSyncPropertyInspectionProxies = require('./pubsub/sync-property-inspection-proxies');
const createSyncCompletedInspectionProxies = require('./pubsub/sync-completed-inspection-proxies');
const createAPIGetInspectionPDF = require('./on-get-pdf-report/get-pdf-handler');

module.exports = {
  processWrite,
  getLatestCompleted,
  onCreateWatcher,
  createOnWriteAttributeWatcher,
  createOnDeleteWatcher,
  createOnGetPDFReportHandler,

  pubsub: {
    createCleanupProxyOrphans,
    createSyncPropertyInspectionProxies,
    createSyncCompletedInspectionProxies,
  },

  api: {
    createPatchProperty: createAPIPatchProperty,
    createGetInspectionPDF: createAPIGetInspectionPDF,
  },
};
