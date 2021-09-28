const trelloCardDescriptionTemplate = `Job
{{#if propertyName}}Property: {{{propertyName}}}{{/if}}
{{#if jobTitle}}Job: {{{jobTitle}}}{{/if}}{{#if clientUrl}}

Sparkle job: {{{clientUrl}}}{{/if}}`;

module.exports = {
  authorizedRuleTypes: ['default', 'expedite', 'large'], // 1st is default
  stateTypes: ['open', 'approved', 'authorized', 'complete'], // 1st is default
  typeValues: ['small:pm', 'small:hybrid', 'large:am', 'large:sc'], // 1st is default

  /**
   * Template for all Jobs Trello card
   * descriptions
   * @type {String}
   */
  trelloCardDescriptionTemplate,
};
