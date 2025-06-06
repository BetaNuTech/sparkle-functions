const createTaskFromDeficiency = require('./create-task-from-deficiency');
const createTaskFromJob = require('./create-task-from-job');
const mapSparkleStatusToClickUp = require('./map-sparkle-status-to-clickup');
const buildTaskComment = require('./build-task-comment');

module.exports = {
  createTaskFromDeficiency,
  createTaskFromJob,
  mapSparkleStatusToClickUp,
  buildTaskComment,
};