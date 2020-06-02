const functions = require('firebase-functions');
const deficientItems = require('./deficient-items');
const templateCategories = require('./template-categories');

module.exports = (db, fs, pubsubClient) => {
  return {
    deficientItemsPropertyMetaSyncV2: functions.firestore
      .document('deficiencies/{deficiencyId}')
      .onUpdate(
        deficientItems.createOnUpdateStateV2(
          fs,
          pubsubClient,
          'deficient-item-status-update'
        )
      ),

    deficientItemsArchivingV2: functions.firestore
      .document('deficiencies/{deficiencyId}')
      .onUpdate(deficientItems.createOnUpdateArchiveV2(db, fs)),

    deficientItemsUnarchivingV2: functions.firestore
      .document('archives/{deficiencyId}')
      .onUpdate(deficientItems.createOnUpdateArchiveV2(db, fs)),

    templateCategoryDeleteV2: functions.firestore
      .document('/templateCategories/{categoryId}')
      .onDelete(templateCategories.createOnDeleteWatcherV2(fs)),
  };
};
