const trelloCardDescriptionTemplate = `Job
{{#if propertyName}}Property: {{{propertyName}}}{{/if}}
{{#if jobTitle}}Job: {{{jobTitle}}}{{/if}}{{#if clientUrl}}

Sparkle job: {{{clientUrl}}}{{/if}}`;

module.exports = {
  authorizedRuleTypes: ['default', 'expedite'], // 1st is default
  stateTypes: ['open', 'approved', 'authorized', 'complete'], // 1st is default
  typeValues: ['improvement', 'maintenance'],
  /**
   * Template for all Jobs Trello card
   * descriptions
   * @type {String}
   */
  trelloCardDescriptionTemplate,
};
