const assert = require('assert');
const hbs = require('handlebars');

const templates = {
  // /////////////////////////////////////////
  // Property Deficient Item - State Update
  // /////////////////////////////////////////

  'deficient-item-state-change-summary':
    'Deficient Item: {{{title}}} moved from {{{previousState}}} to {{{state}}} by Sparkle',

  'deficient-item-state-change-markdown-body': `Deficient Item moved{{#if previousState}} from *{{{previousState}}}*{{/if}}{{#if state}} to state *{{{state}}}*.{{/if}}

\`\`\`
{{#if title}}Title: {{{title}}}{{/if}}
{{#if section}}Section: {{{section}}}{{/if}}
{{#if subSection}}Sub-section: {{{subSection}}}{{/if}}
{{#if currentDeferredDateDay}}Deferred Due Date: {{{currentDeferredDateDay}}}{{else}}{{#if currentDueDateDay}}Due Date: {{{currentDueDateDay}}}{{/if}}{{/if}}
{{#if currentPlanToFix}}Plan to fix: {{{currentPlanToFix}}}{{/if}}
{{#if currentResponsibilityGroup}}Responsibility Group: {{{currentResponsibilityGroup}}}{{/if}}
\`\`\`{{#if currentProgressNote}}
\`\`\`
Progress Note{{#if progressNoteDateDay}} ({{{progressNoteDateDay}}}){{/if}}: {{{currentProgressNote}}}
\`\`\`{{/if}}{{#if currentCompleteNowReason}}
\`\`\`
Complete Now Reason: {{{currentCompleteNowReason}}}
\`\`\`{{/if}}{{#if currentReasonIncomplete}}
\`\`\`
Reason Incomplete: {{{currentReasonIncomplete}}}
\`\`\`{{/if}}
Deficient Item: {{{url}}}{{#if trelloUrl}}

Trello Card: {{{trelloUrl}}}{{/if}}

*Updated by*: Sparkle`,

  // ////////////////////////////////////////
  // Property Inspection - Report Creation
  // ////////////////////////////////////////

  'inspection-pdf-creation-summary':
    '{{{createdAt}}} inspection report created by{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})',

  'inspection-pdf-creation-markdown-body': `*Inspection Report Creation*

\`\`\`
{{#if templateName}}Template: {{{templateName}}}{{/if}}
{{#if startDate}}Inspection Start Date: {{{startDate}}}{{/if}}
{{#if completeDate}}Inspection Completion Date: {{{completeDate}}}{{/if}}
\`\`\`{{#if inspectionUrl}}
Inspection: {{{inspectionUrl}}}{{/if}}{{#if reportUrl}}

Inspection Report: {{{reportUrl}}}{{/if}}

*Created by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////////////////////
  // Property Inspection - Report Update
  // /////////////////////////////////////

  'inspection-pdf-update-summary':
    '{{{updatedAt}}} inspection report updated by{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})',

  'inspection-pdf-update-markdown-body': `*Inspection Report Update*

  \`\`\`
  {{#if templateName}}Template: {{{templateName}}}{{/if}}
  {{#if startDate}}Inspection Start Date: {{{startDate}}}{{/if}}
  {{#if completeDate}}Inspection Completion Date: {{{completeDate}}}{{/if}}
  \`\`\`{{#if inspectionUrl}}
  Inspection: {{{inspectionUrl}}}{{/if}}{{#if reportUrl}}

  Inspection Report: {{{reportUrl}}}{{/if}}

  *Updated by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,
};

/**
 * Compile a predefined tempate
 * with a given data context for
 * a source notification's content
 * @param  {String} templateName
 * @param  {Object} context
 * @return {String} - interpolated template
 */
module.exports = function compileTemplate(templateName = '', context = {}) {
  const templateStr = templates[templateName];
  assert(
    templateStr && typeof templateStr === 'string',
    'has valid template name'
  );
  assert(context && typeof context === 'object', 'has context object');
  const template = hbs.compile(templateStr);
  return template(context).replace(/^\s*$[\n\r]{1,}/gm, '');
};
