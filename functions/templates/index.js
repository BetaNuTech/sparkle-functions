const createSyncTemplatesList = require('./pubsub/sync-templates-list');
const createSyncPropertyTemplatesList = require('./pubsub/sync-property-templates-list');

module.exports = {
  pubsub: {
    createSyncTemplatesList,
    createSyncPropertyTemplatesList,
  },
};
