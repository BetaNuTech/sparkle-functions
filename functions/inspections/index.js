const processWrite = require('./process-write');
const onWriteV2 = require('./on-write-v2');
const onDeleteV2 = require('./on-delete-v2');
const createAPIPatchProperty = require('./api/patch-property');
const createAPIGetInspectionPDF = require('./on-get-pdf-report/get-pdf-handler');

module.exports = {
  processWrite,
  onDeleteV2,
  onWriteV2,

  api: {
    createPatchProperty: createAPIPatchProperty,
    createGetInspectionPDF: createAPIGetInspectionPDF,
  },
};
