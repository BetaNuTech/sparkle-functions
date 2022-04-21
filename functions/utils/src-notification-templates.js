const assert = require('assert');
const hbs = require('handlebars');

const templates = {
  // /////////////////////////////////////////
  // Property Deficient Item - State Update
  // /////////////////////////////////////////

  'deficient-item-state-change-summary':
    'Deficient Item: {{{title}}} moved from {{{previousState}}} to {{{state}}} by {{#if authorName}}{{{authorName}}}{{else}}Sparkle{{/if}}',

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

  // /////////////////////////////////////////////
  // Property Deficient Item - Non-State Update
  // /////////////////////////////////////////////

  'deficient-item-update-summary':
    'Deficient Item: {{{title}}} updated{{#if authorName}} by {{{authorName}}}{{/if}}',

  'deficient-item-update-markdown-body': `*Deficient Item Updated*
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
*Updated by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ///////////////////////////////////////////
  // Property Deficient Item - Progress Note
  // ///////////////////////////////////////////

  'deficient-item-progress-note-summary':
    'Progress Note just added to Deficient Item {{{title}}} by{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})',

  'deficient-item-progress-note-markdown-body': `Progress Note just added to Deficient Item.
\`\`\`
{{#if title}}Title: {{{title}}}{{/if}}
{{#if section}}Section: {{{section}}}{{/if}}
{{#if subSection}}Sub-section: {{{subSection}}}{{/if}}
{{#if dueDateDay}}Due Date: {{{dueDateDay}}}{{/if}}
{{#if currentResponsibilityGroup}}Responsibility Group: {{{currentResponsibilityGroup}}}{{/if}}
{{#if currentPlanToFix}}Plan to fix: {{{currentPlanToFix}}}{{/if}}
\`\`\`{{#if progressNote}}
\`\`\`
{{{progressNote}}}
\`\`\`{{/if}}
*Added by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////////////////////////////////
  // Property Deficient Item - Trello Card Creation
  // /////////////////////////////////////////////////

  'deficient-item-trello-card-create-summary':
    'Trello card created for Deficient Item: {{{title}}}{{#if authorName}} by {{{authorName}}}{{/if}}',

  'deficient-item-trello-card-create-markdown-body': `*Trello card created for deficient item.*
\`\`\`
{{#if title}}Title: {{{title}}}{{/if}}
{{#if section}}Section: {{{section}}}{{/if}}
{{#if subSection}}Sub-section: {{{subSection}}}{{/if}}
\`\`\`{{#if trelloCardURL}}
Trello Card: {{{trelloCardURL}}}{{/if}}
*Created by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

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

  // /////////////////////////////////
  // Property Inspection Completion
  // /////////////////////////////////

  'inspection-completion-summary':
    '{{{completionDate}}} inspection completed by{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}}), using {{{templateName}}} template',

  'inspection-completion-markdown-body': `*Inspection Completed*
\`\`\`
{{#if templateName}}Template: {{{templateName}}}{{/if}}
{{#if startDate}}Inspection Start Date: {{{startDate}}}{{/if}}
{{#if score}}Score: {{{score}}}{{/if}}
{{#if deficientItemCount}}# of deficient items: {{{deficientItemCount}}}{{/if}}
\`\`\`{{#if url}}
Inspection: {{{url}}}{{/if}}
*Completed by*: {{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////////////////////
  // Property Creation
  // /////////////////////////////////////
  'property-creation-summary':
    '{{name}} created{{#if authorName}} by {{{authorName}}}{{/if}}',

  'property-creation-markdown-body': `\`\`\`
{{#if name}}Name: {{{name}}}{{/if}}
{{#if addr1}}Addr1: {{{addr1}}}{{/if}}
{{#if addr2}}Addr2: {{{addr2}}}{{/if}}
{{#if city}}City: {{{city}}}{{/if}}
{{#if state}}State: {{{state}}}{{/if}}
{{#if zip}}zipcode: {{{zip}}}{{/if}}
{{#if teamName}}Team: {{{teamName}}}{{/if}}
{{#if code}}Cobalt Property Code: {{{code}}}{{/if}}
{{#if slackChannel}}Slack Channel: {{{slackChannel}}}{{/if}}
{{#if templateNames}}Templates: {{{templateNames}}}{{/if}}
{{#if bannerPhotoURL}}bannerPhotoURL: {{{bannerPhotoURL}}}{{/if}}
{{#if photoURL}}photoURL: {{{photoURL}}}{{/if}}
\`\`\`
*Created by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // //////////////////
  // Property Update
  // //////////////////

  'property-update-summary':
    '{{name}} updated{{#if authorName}} by {{{authorName}}}{{/if}}',

  'property-update-markdown-body': `Previous Data:
\`\`\`
{{#if previousName}}Name: {{{previousName}}}{{/if}}
{{#if previousAddr1}}Addr1: {{{previousAddr1}}}{{/if}}
{{#if previousAddr2}}Addr2: {{{previousAddr2}}}{{/if}}
{{#if previousCity}}City: {{{previousCity}}}{{/if}}
{{#if previousState}}State: {{{previousState}}}{{/if}}
{{#if previousZip}}zipcode: {{{previousZip}}}{{/if}}
{{#if previousTeamName}}Team: {{{previousTeamName}}}{{/if}}
{{#if previousCode}}Cobalt Property Code: {{{previousCode}}}{{/if}}
{{#if previousSlackChannel}}Slack Channel: {{{previousSlackChannel}}}{{/if}}
{{#if previousTemplateNames}}Templates: {{{previousTemplateNames}}}{{/if}}
{{#if previousBannerPhotoURL}}bannerPhotoURL: {{{previousBannerPhotoURL}}}{{/if}}
{{#if previousPhotoURL}}photoURL: {{{previousPhotoURL}}}{{/if}}
\`\`\`
New Data:
\`\`\`
{{#if currentName}}Name: {{{currentName}}}{{/if}}
{{#if currentAddr1}}Addr1: {{{currentAddr1}}}{{/if}}
{{#if currentAddr2}}Addr2: {{{currentAddr2}}}{{/if}}
{{#if currentCity}}City: {{{currentCity}}}{{/if}}
{{#if currentState}}State: {{{currentState}}}{{/if}}
{{#if currentZip}}zipcode: {{{currentZip}}}{{/if}}
{{#if currentTeamName}}Team: {{{currentTeamName}}}{{/if}}
{{#if currentCode}}Cobalt Property Code: {{{currentCode}}}{{/if}}
{{#if currentSlackChannel}}Slack Channel: {{{currentSlackChannel}}}{{/if}}
{{#if currentTemplateNames}}Templates: {{{currentTemplateNames}}}{{/if}}
{{#if currentBannerPhotoURL}}bannerPhotoURL: {{{currentBannerPhotoURL}}}{{/if}}
{{#if currentPhotoURL}}photoURL: {{{currentPhotoURL}}}{{/if}}
\`\`\`
*Edited by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ///////////////////////////////////
  // Property Inspection Reassignment
  // //////////////////////////////////
  'inspection-reassign-summary':
    '{{{currentDate}}} inspection moved{{#if authorName}} by {{{authorName}}}{{/if}}',

  'inspection-reassign-markdown-body': `*Inspection Moved*
\`Inspection created on {{{startDate}}}, with template: {{{templateName}}} has moved to {{{propertyName}}}\`
*Moved by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ////////////////////
  // Template Creation
  // ////////////////////

  'template-creation-summary':
    '{{{name}}} created{{#if authorName}} by {{{authorName}}}{{/if}}',

  'template-creation-markdown-body': `\`\`\`
{{#if name}}Name: {{{name}}}{{/if}}
{{#if description}}Description: {{{description}}}{{/if}}
{{#if category}}Category: {{{category}}}{{/if}}
{{#if sectionsCount}}# of section(s): {{{sectionsCount}}}{{/if}}
{{#if itemsCount}}# of item(s): {{{itemsCount}}}{{/if}}
\`\`\`
*Created by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // //////////////////
  // Template Update
  // //////////////////

  'template-update-summary':
    '{{{name}}} updated{{#if authorName}} by {{{authorName}}}{{/if}}',

  'template-update-markdown-body': `Previous Data:
\`\`\`
{{#if previousName}}Name: {{{previousName}}}{{/if}}
{{#if previousDescription}}Description: {{{previousDescription}}}{{/if}}
{{#if previousCategory}}Category: {{{previousCategory}}}{{/if}}
{{#if previousSectionsCount}}# of section(s): {{{previousSectionsCount}}}{{/if}}
{{#if previousItemsCount}}# of item(s): {{{previousItemsCount}}}{{/if}}
\`\`\`
New Data:
\`\`\`
{{#if currentName}}Name: {{{currentName}}}{{/if}}
{{#if currentDescription}}Description: {{{currentDescription}}}{{/if}}
{{#if currentCategory}}Category: {{{currentCategory}}}{{/if}}
{{#if currentSectionsCount}}# of section(s): {{{currentSectionsCount}}}{{/if}}
{{#if currentItemsCount}}# of item(s): {{{currentItemsCount}}}{{/if}}
\`\`\`
*Edited by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ////////////////////
  // Template Deletion
  // ////////////////////

  'template-delete-summary':
    '{{{name}}} deleted{{#if authorName}} by {{{authorName}}}{{/if}}',

  'template-delete-markdown-body': `\`{{{name}}} deleted\`
*Deleted by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////////////
  // Template Category Creation
  // /////////////////////////////

  'template-category-created-summary':
    '{{{name}}} created{{#if authorName}} by {{{authorName}}}{{/if}}',

  'template-category-created-markdown-body': `\`\`\`
{{#if name}}Name: {{{name}}}{{/if}}
\`\`\`
*Created by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////////////
  // Template Category Deletion
  // /////////////////////////////

  'template-category-delete-summary':
    '{{{name}}} deleted{{#if authorName}} by {{{authorName}}}{{/if}}',

  'template-category-delete-markdown-body': `\`{{{name}}} deleted\`
*Deleted by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ///////////////////////////
  // Template Category Update
  // ///////////////////////////

  'template-category-update-summary':
    '{{{previousName}}} updated to {{{name}}}{{#if authorName}} by {{{authorName}}}{{/if}}',

  'template-category-update-markdown-body': `Previous Data:
\`\`\`
Name: {{{previousName}}}
\`\`\`
New Data:
\`\`\`
Name: {{{name}}}
\`\`\`
*Edited by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ////////////////
  // Team Creation
  // ////////////////

  'team-created-summary':
    '{{{name}}} created{{#if authorName}} by {{{authorName}}}{{/if}}',

  'team-created-markdown-body': `\`\`\`
Name: {{{name}}}
\`\`\`
*Created by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // //////////////
  // Team Update
  // //////////////

  'team-update-summary':
    '{{{previousName}}} updated to {{{name}}}{{#if authorName}} by {{{authorName}}}{{/if}}',

  'team-update-markdown-body': `Previous Data:
\`\`\`
Name: {{{previousName}}}
\`\`\`
New Data:
\`\`\`
Name: {{{name}}}
\`\`\`
*Edited by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // ////////////////
  // Team Deletion
  // ////////////////

  'team-delete-summary':
    'The team {{{name}}} deleted{{#if authorName}} by {{{authorName}}}{{/if}}',

  'team-delete-markdown-body': `\`{{{name}}} deleted\`
*Deleted by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////
  // Slack App Addition
  // /////////////////////

  'slack-integration-added-summary':
    'The Sparkle Slack App added to team {{{name}}}{{#if authorName}} by {{{authorName}}}{{/if}}',

  'slack-integration-added-markdown-body': `\`\`\`
Slack Team: {{{name}}}
\`\`\`
*Added by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // //////////////////////////////
  // Slack System Channel Update
  // //////////////////////////////

  'slack-system-channel-update-summary':
    'System Channel updated to {{{name}}}{{#if authorName}} by {{{authorName}}}{{/if}}',
  'slack-system-channel-update-markdown-body': `\`\`\`
Channel Name: {{{name}}}
\`\`\`
*Added by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // //////////////////////////////
  // Trello Integration Addition
  // //////////////////////////////

  'trello-integration-added-summary':
    'The trello account {{{name}}} (@{{{username}}}) added{{#if authorName}} by {{{authorName}}}{{/if}}',

  'trello-integration-added-markdown-body': `\`\`\`
{{#if name}}Name: {{{name}}}{{/if}}
{{#if username}}Username: @{{{username}}}{{/if}}
\`\`\`
*Added by*:{{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,

  // /////////////////////////////
  // Trello Integration Removal
  // ////////////////////////////

  'trello-integration-removal-summary':
    'The trello account {{{name}}} (@{{{username}}}) removed{{#if authorName}} by {{{authorName}}}{{/if}}',

  'trello-integration-removal-markdown-body': `\`{{{name}}}{{#if username}} (@{{{username}}}){{/if}} removed\`
*Removed by*: {{#if authorName}} {{{authorName}}}{{/if}} ({{{authorEmail}}})`,
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
