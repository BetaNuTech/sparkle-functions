const createOnInspectionWrite = require('./on-inspection-write-watcher');
const createOnDiStateUpdate = require('./on-di-state-update-watcher');
const createOnDiToggleArchiveUpdate = require('./on-di-toggle-archive-update-watcher');
const cron = require('./cron');

module.exports = {
  createOnInspectionWrite,
  createOnDiStateUpdate,
  createOnDiToggleArchiveUpdate,
  cron,
};
