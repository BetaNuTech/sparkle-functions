const onWriteV2 = require('./on-write-v2');
const onDeleteWatcherV2 = require('./on-delete-watcher-v2');
const getPropertyYardiResidents = require('./api/get-property-yardi-residents');
const getPropertyYardiWorkOrders = require('./api/get-property-yardi-work-orders');
const post = require('./api/post');
const put = require('./api/put');
const propertyCode = require('./middleware/property-code');
const yardiIntegration = require('./middleware/yardi-integration');
const uploadFile = require('./api/uploadFile');

module.exports = {
  onDeleteWatcherV2,
  onWriteV2,
  api: {
    getPropertyYardiResidents,
    getPropertyYardiWorkOrders,
    post,
    put,
    uploadFile,
  },
  middleware: { propertyCode, yardiIntegration },
};
