const list = require('./utils/list');
const createOnWriteWatcher = require('./on-write-watcher');
const createSyncTemplatesList = require('./pubsub/sync-templates-list');
const createSyncPropertyTemplatesList = require('./pubsub/sync-property-templates-list');

module.exports = {
  list,
  createOnWriteWatcher,

  pubsub: {
    createSyncTemplatesList,
    createSyncPropertyTemplatesList,
  },
};
