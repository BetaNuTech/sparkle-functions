const processWrite = require('./process-write');
const onWriteV2 = require('./on-write-v2');
const createOnDeleteWatcher = require('./on-delete-watcher');
const onDeleteV2 = require('./on-delete-v2');
const onCreateWatcher = require('./on-create-watcher');
const createOnGetPDFReportHandler = require('./on-get-pdf-report');
const getLatestCompleted = require('./api/get-latest-completed');
const createAPIPatchProperty = require('./api/patch-property');
const createCleanupProxyOrphans = require('./pubsub/cleanup-proxy-orphans');
const createSyncPropertyInspectionProxies = require('./pubsub/sync-property-inspection-proxies');
const createSyncCompletedInspectionProxies = require('./pubsub/sync-completed-inspection-proxies');
const createAPIGetInspectionPDF = require('./on-get-pdf-report/get-pdf-handler');

module.exports = {
  processWrite,
  getLatestCompleted,
  onCreateWatcher,
  onDeleteV2,
  onWriteV2,
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
