const assert = require('assert');
const handlebars = require('handlebars');
const config = require('../../config');
const clickupService = require('../../services/clickup');
const mapSparkleStatusToClickUp = require('./map-sparkle-status-to-clickup');

/**
 * Create a ClickUp task from a Sparkle deficient item
 * @param  {String} apiToken - ClickUp API token
 * @param  {String} listId - ClickUp list ID where task will be created
 * @param  {Object} deficiency - Deficient item data
 * @param  {Object} property - Property data
 * @param  {Array} assigneeIds - ClickUp user IDs to assign
 * @return {Promise} - resolves to ClickUp task response
 */
module.exports = async function createTaskFromDeficiency(apiToken, listId, deficiency, property, assigneeIds = []) {
  assert(typeof apiToken === 'string', 'has api token');
  assert(typeof listId === 'string', 'has list id');
  assert(deficiency && typeof deficiency === 'object', 'has deficiency');
  assert(property && typeof property === 'object', 'has property');
  
  const { clickup } = config;
  
  // Compile description template
  const template = handlebars.compile(clickup.deficientItemTaskDescriptionTemplate);
  const description = template({
    ...deficiency,
    propertyName: property.name,
    createdAt: new Date(deficiency.createdAt || Date.now()).toLocaleDateString(),
    currentDueDateDay: deficiency.currentDueDate ? new Date(deficiency.currentDueDate).toLocaleDateString() : null,
    url: deficiency.clientUrl || null,
  });
  
  // Build task data
  const taskData = {
    name: `${deficiency.itemTitle || 'Deficient Item'} - ${property.name}`,
    description,
    status: mapSparkleStatusToClickUp(deficiency.state, 'deficiency'),
    priority: clickup.priorityMapping[deficiency.itemScore] || clickup.defaults.taskPriority,
    assignees: assigneeIds,
    tags: [
      clickup.tags.deficientItem,
      clickup.tags.sparkle,
      clickup.tags.automated,
      property.code || `property-${property.id}`,
      (deficiency.currentResponsibilityGroup && deficiency.currentResponsibilityGroup.toLowerCase().replace(/[^a-z0-9]/g, '-')) || 'unassigned'
    ].filter(Boolean),
    notify_all: clickup.defaults.notifyAssignees,
  };
  
  // Add due date if available and enabled
  if (clickup.defaults.enableDueDates && deficiency.currentDueDate) {
    taskData.due_date = new Date(deficiency.currentDueDate).getTime();
  }
  
  // Create the task
  const taskResponse = await clickupService.createTask(apiToken, listId, taskData);
  
  return taskResponse;
};