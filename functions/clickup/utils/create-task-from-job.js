const assert = require('assert');
const handlebars = require('handlebars');
const config = require('../../config');
const clickupService = require('../../services/clickup');
const mapSparkleStatusToClickUp = require('./map-sparkle-status-to-clickup');

/**
 * Create a ClickUp task from a Sparkle job
 * @param  {String} apiToken - ClickUp API token
 * @param  {String} listId - ClickUp list ID where task will be created
 * @param  {Object} job - Job data
 * @param  {Object} property - Property data
 * @param  {Array} assigneeIds - ClickUp user IDs to assign
 * @return {Promise} - resolves to ClickUp task response
 */
module.exports = async function createTaskFromJob(apiToken, listId, job, property, assigneeIds = []) {
  assert(typeof apiToken === 'string', 'has api token');
  assert(typeof listId === 'string', 'has list id');
  assert(job && typeof job === 'object', 'has job');
  assert(property && typeof property === 'object', 'has property');
  
  const { clickup } = config;
  
  // Compile description template
  const template = handlebars.compile(clickup.jobTaskDescriptionTemplate);
  const description = template({
    ...job,
    propertyName: property.name,
    completionDate: job.completionDate ? new Date(job.completionDate).toLocaleDateString() : null,
    clientUrl: job.clientUrl || null,
  });
  
  // Build task data
  const taskData = {
    name: `${job.jobTitle || 'Job'} - ${property.name}`,
    description,
    status: mapSparkleStatusToClickUp(job.state, 'job'),
    priority: clickup.defaults.taskPriority, // Jobs don't have scores like deficiencies
    assignees: assigneeIds,
    tags: [
      clickup.tags.job,
      clickup.tags.sparkle,
      clickup.tags.automated,
      property.code || `property-${property.id}`,
      job.type?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'general'
    ].filter(Boolean),
    notify_all: clickup.defaults.notifyAssignees,
  };
  
  // Add due date if available and enabled
  if (clickup.defaults.enableDueDates && job.completionDate) {
    taskData.due_date = new Date(job.completionDate).getTime();
  }
  
  // Create the task
  const taskResponse = await clickupService.createTask(apiToken, listId, taskData);
  
  return taskResponse;
};