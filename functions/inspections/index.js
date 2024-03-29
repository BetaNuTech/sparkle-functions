const onWriteV2 = require('./on-write-v2');
const onDeleteV2 = require('./on-delete-v2');
const createAPIPatchProperty = require('./api/patch-property');
const post = require('./api/post');
const getLatestCompletedInspection = require('./api/get-latest-completed');
const createPatchReportPDF = require('./api/patch-report-pdf');
const patchTemplate = require('./api/patch-template');
const postTemplateItemImage = require('./api/post-template-item-image');
const propertyAuthSetupMiddleware = require('./api/property-auth-setup-middleware');
const generateReportPdf = require('./pubsub/generate-report-pdf');
const reportPdfSync = require('./pubsub/report-pdf-sync');

module.exports = {
  onDeleteV2,
  onWriteV2,

  api: {
    createPatchProperty: createAPIPatchProperty,
    createPatchReportPDF,
    getLatestCompletedInspection,
    post,
    patchTemplate,
    postTemplateItemImage,
    propertyAuthSetupMiddleware,
  },

  pubsub: {
    generateReportPdf,
    reportPdfSync,
  },
};
