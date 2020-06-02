const onWrite = require('./on-write');
const createOnDeleteWatcher = require('./on-delete-watcher');
const createOnDeleteWatcherV2 = require('./on-delete-watcher-v2');

module.exports = {
  onWrite,
  createOnDeleteWatcher,
  createOnDeleteWatcherV2,
};
