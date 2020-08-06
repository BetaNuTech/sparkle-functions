const onWriteV2 = require('./on-write-v2');
const onDeleteWatcherV2 = require('./on-delete-watcher-v2');
const getPropertyYardiResidents = require('./api/get-property-yardi-residents');
const getPropertyYardiWorkOrders = require('./api/get-property-yardi-work-orders');
const propertyCode = require('./middleware/property-code');
const yardiIntegration = require('./middleware/yardi-integration');
const processMeta = require('./utils/process-meta');

module.exports = {
  onDeleteWatcherV2,
  onWriteV2,
  api: {
    getPropertyYardiResidents,
    getPropertyYardiWorkOrders,
  },
  middleware: { propertyCode, yardiIntegration },
  utils: { processMeta },
};
