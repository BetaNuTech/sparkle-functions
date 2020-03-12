const createOnWriteWatcher = require('./on-write-watcher');
const createSyncTemplatesList = require('./pubsub/sync-templates-list');
const createSyncPropertyTemplatesList = require('./pubsub/sync-property-templates-list');

module.exports = {
  createOnWriteWatcher,

  pubsub: {
    createSyncTemplatesList,
    createSyncPropertyTemplatesList,
  },
};
