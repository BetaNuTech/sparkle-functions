const onWriteV2 = require('./on-write-v2');
const onDeleteV2 = require('./on-delete-v2');
const createAPIPatchProperty = require('./api/patch-property');
const post = require('./api/post');
const createAPIGetInspectionPDF = require('./on-get-pdf-report');
const getLatestCompletedInspection = require('./api/get-latest-completed');
const createPatchReportPDF = require('./api/patch-report-pdf');
const patchTemplate = require('./api/patch-template');

module.exports = {
  onDeleteV2,
  onWriteV2,

  api: {
    createPatchProperty: createAPIPatchProperty,
    createGetInspectionPDF: createAPIGetInspectionPDF,
    createPatchReportPDF,
    getLatestCompletedInspection,
    post,
    patchTemplate,
  },
};
