module.exports = {
  requiredActionStates: ['requires-action', 'go-back', 'overdue'],
  followUpActionStates: ['completed', 'incomplete'],
  overdueEligibleStates: ['pending', 'requires-progress-update'],

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
};
