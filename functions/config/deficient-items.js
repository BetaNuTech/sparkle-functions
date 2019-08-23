const reqActionToPendingTransTempl = `{{firstName}} {{lastName}} ({{email}}) has moved the deficient item to PENDING state.

DUE DATE: {{currentDueDateDay}}
RESPONSIBILITY GROUP: {{currentResponsibilityGroup}}
PLAN TO FIX: {{currentPlanToFix}}`;
const manyToDeferredTransTempl = `{{firstName}} {{lastName}} ({{email}}) has moved the deficient item to DEFERRED state, from NEW/PENDING/GOBACK state.

DEFERRED DATE: {{currentDeferredDateDay}}
[PREVIOUS DUE DATE: {{previousDueDateDay}}]`;
const pendingToReqProgUpTransTempl = `ACTION REQUIRED: Sparkle requests a progress update, since Deficient Item is more than halfway to Due Date now.  Please add a progress note to Deficient Item in Sparkle.`;
const pendingToOverdueTransTempl = `ACTION REQUIRED: Sparkle requests a reason incomplete, since Deficient Item is now past the specified Due Date.  Please add a reason incomplete to the Deficient Item in Sparkle.`;
const reqProgUpToPendingTransTempl = `{{firstName}} {{lastName}} ({{email}}) has added a progress note, moving the Deficient Item back to PENDING state.

{{currentProgressNote}}`;
const reqProgUpToOverdueTransTempl = `ACTION REQUIRED: Sparkle requests a reason incomplete, since Deficient Item is now past the specified Due Date.  Please add a reason incomplete to Deficient Item in Sparkle.`;
const overdueToIncompleteTransTempl = `ACTION REQUIRED: Deficient Item is now in INCOMPLETE state.  As a corporate user, please use Sparkle to review and move Deficient Item to GO-BACK or CLOSED state.

{{firstName}} {{lastName}} ({{email}}) has added a reason incomplete, moving the Deficient Item to the INCOMPLETE state.

{{currentReasonIncomplete}}`;
const incompleteToGoBackTransTempl = `ACTION REQUIRED: Deficient Item requires new DUE DATE, PLAN TO FIX, and RESPONSIBILITY GROUP.

{{firstName}} {{lastName}} ({{email}}) has extended the Deficient Item by moving it back into GOBACK state, from INCOMPLETE state.`;
const incompleteToClosedTransTempl = `{{firstName}} {{lastName}} ({{email}}) has CLOSED the Deficient Item, from an INCOMPLETE state.`;
const pendingToCompletedTransTempl = `ACTION REQUIRED: Deficient Item has been COMPLETED, but requires corporate review to be CLOSED or moved to GOBACK state. Completed photo(s) added as well.  (See Sparkle app to review, and take required action)

{{firstName}} {{lastName}} ({{email}}) has COMPLETED the Deficient Item.`;
const completedToClosedTransTempl = `{{firstName}} {{lastName}} ({{email}}) has approved and CLOSED the Deficient Item, moving it from COMPLETED state.`;
const completedToGoBackTransTempl = `ACTION REQUIRED: Deficient Item requires new DUE DATE, PLAN TO FIX, and RESPONSIBILITY GROUP.

{{firstName}} {{lastName}} ({{email}}) has rejected the Deficient Item, moving it from COMPLETED to GOBACK state.`;
const defaultCommentTempl = `{{firstName}} {{lastName}} ({{email}}) has changed the state of the Deficient Item from {{previousState}} to {{currentState}}`;

module.exports = {
  dbPath: '/propertyInspectionDeficientItems',
  initialState: 'requires-action',
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
   * Responsibilty Group Index
   * @type {Object}
   */
  responsibilityGroups: {
    'site_level_in-house': 'Site Level, In-House',
    site_level_manages_vendor: 'Site Level, Managing Vendor',
    corporate: 'Corporate',
    corporate_manages_vendor: 'Corporate, Managing Vendor',
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
      {
        previous: ['pending'],
        current: ['requires-progress-update'],
        value: pendingToReqProgUpTransTempl,
      },
      {
        previous: ['pending'],
        current: ['overdue'],
        value: pendingToOverdueTransTempl,
      },
      {
        previous: ['requires-progress-update'],
        current: ['pending'],
        value: reqProgUpToPendingTransTempl,
      },
      {
        previous: ['requires-progress-update'],
        current: ['overdue'],
        value: reqProgUpToOverdueTransTempl,
      },
      {
        previous: ['overdue'],
        current: ['incomplete'],
        value: overdueToIncompleteTransTempl,
      },
      {
        previous: ['incomplete'],
        current: ['go-back'],
        value: incompleteToGoBackTransTempl,
      },
      {
        previous: ['incomplete'],
        current: ['closed'],
        value: incompleteToClosedTransTempl,
      },
      {
        previous: ['pending'],
        current: ['completed'],
        value: pendingToCompletedTransTempl,
      },
      {
        previous: ['completed'],
        current: ['closed'],
        value: completedToClosedTransTempl,
      },
      {
        previous: ['completed'],
        current: ['go-back'],
        value: completedToGoBackTransTempl,
      },
    ],

    /**
     * Generic templates for specific states
     * @param {String} name
     * @param {String} value
     * @type {Object[]}
     */
    states: [],

    /**
     * Generic fallback templates for all comments
     * @type {String}
     */
    default: defaultCommentTempl,
  },
};
