const createOnInspectionWrite = require('./on-inspection-write');
const createOnDiStateUpdate = require('./on-di-state-update');
const createOnDiToggleArchiveUpdate = require('./on-di-toggle-archive-update');
const cron = require('./cron');

module.exports = {
  createOnInspectionWrite,
  createOnDiStateUpdate,
  createOnDiToggleArchiveUpdate,
  cron,
};
