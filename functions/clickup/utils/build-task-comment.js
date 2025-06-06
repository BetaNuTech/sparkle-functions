const assert = require('assert');
const handlebars = require('handlebars');
const config = require('../../config');

/**
 * Build a ClickUp task comment based on state transition
 * @param  {String} previousState - Previous Sparkle state
 * @param  {String} currentState - Current Sparkle state  
 * @param  {Object} data - Template data (user, dates, etc.)
 * @param  {String} type - 'deficiency' or 'job'
 * @return {String} Rendered comment text
 */
module.exports = function buildTaskComment(previousState, currentState, data, type = 'deficiency') {
  assert(typeof previousState === 'string', 'has previous state');
  assert(typeof currentState === 'string', 'has current state');
  assert(data && typeof data === 'object', 'has template data');
  
  const { clickup } = config;
  const templates = type === 'job' ? clickup.jobCommentTemplates : clickup.deficientItemCommentTemplates;
  
  // Try specific transition template first
  const transitionKey = `${previousState}_to_${currentState}`;
  let template = templates[transitionKey];
  
  // Try generic "any" to current state
  if (!template) {
    template = templates[`any_to_${currentState}`];
  }
  
  // Fall back to default template
  if (!template) {
    template = templates.default;
  }
  
  // Compile and render template
  const compiledTemplate = handlebars.compile(template);
  const templateData = {
    ...data,
    previousState,
    currentState,
  };
  
  return compiledTemplate(templateData);
};