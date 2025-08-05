/**
 * ClickUp Integration Configuration
 *
 * Templates and settings for ClickUp task descriptions, comments,
 * and state transitions for both deficient items and jobs.
 */

// Deficient Item Task Description Template
const deficientItemTaskDescriptionTemplate = `**DEFICIENT ITEM** ({{createdAt}})

**Score:** {{itemScore}}{{#if highestItemScore}} of {{highestItemScore}}{{/if}}
**Property:** {{propertyName}}
{{#if sectionTitle}}**Section:** {{sectionTitle}}{{/if}}
{{#if sectionSubtitle}}**Area:** {{sectionSubtitle}}{{/if}}
{{#if currentResponsibilityGroup}}**Responsibility:** {{currentResponsibilityGroup}}{{/if}}
{{#if currentDueDateDay}}**Due Date:** {{currentDueDateDay}}{{/if}}

{{#if itemInspectorNotes}}**Inspector Notes:**
{{itemInspectorNotes}}{{/if}}

{{#if currentPlanToFix}}**Plan to Fix:**
{{currentPlanToFix}}{{/if}}

{{#if url}}**Sparkle Link:** {{url}}{{/if}}

*This deficient item was created automatically from Sparkle.*`;

// Job Task Description Template
const jobTaskDescriptionTemplate = `**JOB**

{{#if propertyName}}**Property:** {{propertyName}}{{/if}}
{{#if jobTitle}}**Job:** {{jobTitle}}{{/if}}
{{#if jobType}}**Type:** {{jobType}}{{/if}}
{{#if estimatedCost}}**Estimated Cost:** \${{estimatedCost}}{{/if}}
{{#if completionDate}}**Target Completion:** {{completionDate}}{{/if}}

{{#if jobDescription}}**Description:**
{{jobDescription}}{{/if}}

{{#if clientUrl}}**Sparkle Link:** {{clientUrl}}{{/if}}

*This job was created automatically from Sparkle.*`;

// Comment Templates for State Transitions
const deficientItemCommentTemplates = {
  // Requires Action → Pending
  'requires-action_to_pending': `{{firstName}} {{lastName}} ({{email}}) moved deficient item to **PENDING**.

**Due Date:** {{currentDueDateDay}}
**Responsibility:** {{currentResponsibilityGroup}}
**Plan to Fix:** {{currentPlanToFix}}`,

  // Any → Deferred
  any_to_deferred: `{{firstName}} {{lastName}} ({{email}}) moved deficient item to **DEFERRED** from {{previousState}}.

**Deferred Date:** {{currentDeferredDateDay}}
{{#if previousDueDateDay}}**Previous Due Date:** {{previousDueDateDay}}{{/if}}`,

  // Pending → Requires Progress Update
  'pending_to_requires-progress-update': `⚠️ **ACTION REQUIRED:** Progress update needed - item is more than halfway to due date.

Please add a progress note in Sparkle.`,

  // Pending → Overdue
  pending_to_overdue: `🚨 **ACTION REQUIRED:** Item is now **OVERDUE**.

Please add reason incomplete in Sparkle.`,

  // Requires Progress Update → Pending
  'requires-progress-update_to_pending': `{{firstName}} {{lastName}} ({{email}}) added progress note, moving back to **PENDING**.

**Progress Note:** {{currentProgressNote}}`,

  // Overdue → Incomplete
  overdue_to_incomplete: `🚨 **INCOMPLETE:** Corporate review required.

{{firstName}} {{lastName}} ({{email}}) added reason incomplete:
{{currentReasonIncomplete}}`,

  // Incomplete → Go Back
  'incomplete_to_go-back': `{{firstName}} {{lastName}} ({{email}}) extended the item back to **GO-BACK**.

⚠️ **ACTION REQUIRED:** New due date, plan to fix, and responsibility group needed.`,

  // Incomplete → Closed
  incomplete_to_closed: `✅ {{firstName}} {{lastName}} ({{email}}) **CLOSED** the deficient item.`,

  // Pending → Completed
  pending_to_completed: `✅ **COMPLETED** - Corporate review required.

{{firstName}} {{lastName}} ({{email}}) completed the deficient item.
Completed photos have been added. Please review in Sparkle.`,

  // Completed → Closed
  completed_to_closed: `✅ {{firstName}} {{lastName}} ({{email}}) approved and **CLOSED** the deficient item.`,

  // Completed → Go Back
  'completed_to_go-back': `{{firstName}} {{lastName}} ({{email}}) rejected completion, moving to **GO-BACK**.

⚠️ **ACTION REQUIRED:** New due date, plan to fix, and responsibility group needed.`,

  // Go Back → Pending
  'go-back_to_pending': `{{firstName}} {{lastName}} ({{email}}) moved deficient item to **PENDING**.

**Due Date:** {{currentDueDateDay}}
**Responsibility:** {{currentResponsibilityGroup}}
**Plan to Fix:** {{currentPlanToFix}}`,

  // Deferred → Go Back
  'deferred_to_go-back': `{{firstName}} {{lastName}} ({{email}}) moved from **DEFERRED** to **GO-BACK**.

⚠️ **ACTION REQUIRED:** New due date, plan to fix, and responsibility group needed.`,

  // Default fallback
  default: `{{firstName}} {{lastName}} ({{email}}) changed state from {{previousState}} to {{currentState}}.`,
};

// Job State Comment Templates
const jobCommentTemplates = {
  open_to_approved: `{{firstName}} {{lastName}} ({{email}}) **APPROVED** the job.`,
  approved_to_authorized: `{{firstName}} {{lastName}} ({{email}}) **AUTHORIZED** the job for work to begin.`,
  authorized_to_complete: `✅ {{firstName}} {{lastName}} ({{email}}) marked the job as **COMPLETE**.`,
  default: `{{firstName}} {{lastName}} ({{email}}) changed job status from {{previousState}} to {{currentState}}.`,
};

// Progress Note Template
const progressNoteTemplate = `{{firstName}} {{lastName}} ({{email}}) added a progress note:

{{progressNote}}`;

// Sparkle State to ClickUp Status Mapping
const deficientItemStatusMapping = {
  'requires-action': 'TO DO',
  pending: 'IN PROGRESS',
  'requires-progress-update': 'IN PROGRESS',
  overdue: 'IN PROGRESS',
  completed: 'IN PROGRESS', // Since NEEDS REVIEW doesn't exist, keep in progress
  incomplete: 'REJECTED',
  deferred: 'ON HOLD',
  'go-back': 'TO DO',
  closed: 'COMPLETE',
};

const jobStatusMapping = {
  open: 'TO DO', // NEEDS REVIEW doesn't exist in jobs list either
  approved: 'APPROVED',
  authorized: 'AUTHORIZED',
  complete: 'COMPLETE',
};

module.exports = {
  // API Configuration
  apiBaseUrl: 'https://api.clickup.com/api/v2',

  // Template Configuration
  deficientItemTaskDescriptionTemplate,
  jobTaskDescriptionTemplate,

  // Comment Templates
  deficientItemCommentTemplates,
  jobCommentTemplates,
  progressNoteTemplate,

  // Status Mappings
  deficientItemStatusMapping,
  jobStatusMapping,

  // Priority Mappings (ClickUp uses 1=urgent, 2=high, 3=normal, 4=low)
  priorityMapping: {
    1: 1, // Urgent
    2: 2, // High
    3: 3, // Normal
    4: 4, // Low
    5: 4, // Default to Low
  },

  // Default Settings
  defaults: {
    taskPriority: 3, // Normal priority
    includeClosedTasks: true,
    notifyAssignees: true,
    enableDueDates: true,
    enableTimeTracking: false,
  },

  // Tag Configuration
  tags: {
    deficientItem: 'deficient-item',
    job: 'job',
    sparkle: 'sparkle',
    automated: 'auto-created',
  },

  // Custom Field Types (for future enhancement)
  customFields: {
    inspectionScore: 'number',
    responsibilityGroup: 'drop_down',
    propertyCode: 'short_text',
    planToFix: 'long_text',
    reasonIncomplete: 'long_text',
    estimatedCost: 'currency',
  },

  // Recommended status configurations for lists
  recommendedStatuses: {
    deficiency: [
      { status: 'TO DO', type: 'open', color: '#d3d3d3' },
      { status: 'IN PROGRESS', type: 'custom', color: '#4194f6' },
      { status: 'NEEDS REVIEW', type: 'done', color: '#f9cb9c' },
      { status: 'ON HOLD', type: 'open', color: '#ff9800' },
      { status: 'REJECTED', type: 'open', color: '#f44336' },
      { status: 'COMPLETE', type: 'closed', color: '#008844' },
    ],
    job: [
      { status: 'NEEDS REVIEW', type: 'open', color: '#f9cb9c' },
      { status: 'APPROVED', type: 'custom', color: '#4dc3ff' },
      { status: 'AUTHORIZED', type: 'done', color: '#02c39a' },
      { status: 'COMPLETE', type: 'closed', color: '#008844' },
    ],
  },

  // Status type mappings for ClickUp workflow
  // Based on ClickUp's status groups: open (not started), custom (active), done (completed but open), closed
  statusTypesByClickUp: {
    open: ['TO DO', 'NEEDS REVIEW', 'ON HOLD', 'REJECTED'],
    custom: ['IN PROGRESS', 'APPROVED'],
    done: ['NEEDS REVIEW', 'AUTHORIZED'],
    closed: ['COMPLETE'],
  },
};
