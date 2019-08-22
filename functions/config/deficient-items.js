const reqActionToPendingTransTempl = `{{firstName}} {{lastName}} ({{email}}) has moved the deficient item to PENDING state.

DUE DATE: {{currentDueDateDay}}
RESPONSIBILITY GROUP: {{currentResponsibilityGroup}}
PLAN TO FIX: {{currentPlanToFix}}`;

const manyToDeferredTransTempl = `{{firstName}} {{lastName}} ({{email}}) has moved the deficient item to DEFERRED state, from NEW/PENDING/GOBACK state.

DEFERRED DATE: {{currentDeferredDate}}
[PREVIOUS DUE DATE: {{previousDueDateDay}}]`;

module.exports = {
  dbPath: '/propertyInspectionDeficientItems',
  requiredActionStates: ['requires-action', 'go-back', 'overdue'],
  followUpActionStates: ['completed', 'incomplete'],
  overdueEligibleStates: ['pending', 'requires-progress-update'],
  excludedPropertyNumOfDeficientItemsStates: ['closed'],

  /**
   * DI proxy attributes mapped
   * to their respective source item names
   * @type {Object}
   */
  inspectionItemProxyAttrs: {
    itemAdminEdits: 'adminEdits',
    itemInspectorNotes: 'inspectorNotes',
    itemMainInputSelection: 'mainInputSelection',
    itemPhotosData: 'photosData',
    sectionSubtitle: 'textInputValue',
  },

  /**
   * Templates for Trello comments
   * @type {Object}
   */
  trelloCommentTemplates: {
    transitions: [
      {
        previous: ['requires-action'],
        current: ['pending'],
        value: reqActionToPendingTransTempl,
      },
      {
        previous: ['requires-action', 'pending', 'go-back'],
        current: ['deferred'],
        value: manyToDeferredTransTempl,
      },
    ],
  },
};
