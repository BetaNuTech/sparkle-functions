const functions = require('firebase-functions');
const properties = require('./properties');
const inspections = require('./inspections');
const deficientItems = require('./deficient-items');
const templateCategories = require('./template-categories');

module.exports = (db, fs, pubsubClient, storage) => {
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

    propertyDeleteV2: functions.firestore
      .document('/properties/{propertyId}')
      .onDelete(properties.onDeleteWatcherV2(fs, storage)),

    propertyWriteV2: functions.firestore
      .document('/properties/{propertyId}')
      .onWrite(properties.onWriteV2(fs)),

    inspectionDeleteV2: functions.firestore
      .document('/inspections/{inspectionId}')
      .onDelete(inspections.onDeleteV2(fs)),

    inspectionWriteV2: functions.firestore
      .document('/inspections/{inspectionId}')
      .onWrite(inspections.onWriteV2(fs)),
  };
};
