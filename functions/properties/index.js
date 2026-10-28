const onWriteV2 = require('./on-write-v2');
const onDeleteWatcherV2 = require('./on-delete-watcher-v2');
const getPropertyYardiResidents = require('./api/get-property-yardi-residents');
const getPropertyYardiWorkOrders = require('./api/get-property-yardi-work-orders');
const postPropertyYardiWorkOrder = require('./api/post-property-yardi-work-order');
const patchPropertyYardiWorkOrder = require('./api/patch-property-yardi-work-order');
const getPropertyYardiCustomValues = require('./api/get-property-yardi-custom-values');
const getPropertyYardiWorkOrder = require('./api/get-property-yardi-work-order');
const getPropertyYardiWorkOrderAttachments = require('./api/get-property-yardi-work-order-attachments');
const getPropertyYardiWorkOrderAttachment = require('./api/get-property-yardi-work-order-attachment');
const postPropertyYardiWorkOrderAttachment = require('./api/post-property-yardi-work-order-attachment');
const post = require('./api/post');
const put = require('./api/put');
const propertyCode = require('./middleware/property-code');
const yardiIntegration = require('./middleware/yardi-integration');
const postImage = require('./api/post-image');

module.exports = {
  onDeleteWatcherV2,
  onWriteV2,
  api: {
    getPropertyYardiResidents,
    getPropertyYardiWorkOrders,
    postPropertyYardiWorkOrder,
    patchPropertyYardiWorkOrder,
    getPropertyYardiCustomValues,
    getPropertyYardiWorkOrder,
    getPropertyYardiWorkOrderAttachments,
    getPropertyYardiWorkOrderAttachment,
    postPropertyYardiWorkOrderAttachment,
    post,
    put,
    postImage,
  },
  middleware: { propertyCode, yardiIntegration },
};
