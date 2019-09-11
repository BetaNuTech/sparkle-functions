const cron = require('./cron');
const createOnWriteHandler = require('./on-write-watcher');
const createOnDeleteHandler = require('./on-delete-watcher');
const createOnTemplatesWriteHandler = require('./on-templates-write-watcher');
const createOnTeamsWriteHandler = require('./on-team-write-watcher');

module.exports = {
  cron,
  createOnDeleteHandler,
  createOnWriteHandler,
  createOnTemplatesWriteHandler,
  createOnTeamsWriteHandler,
};
