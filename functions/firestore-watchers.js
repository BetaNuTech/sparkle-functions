const functions = require('firebase-functions');
const deficientItems = require('./deficient-items');

module.exports = (fs, pubsubClient) => {
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
      .onUpdate(deficientItems.createOnUpdateArchiveV2(fs)),

    deficientItemsUnarchivingV2: functions.firestore
      .document('archives/{deficiencyId}')
      .onUpdate(deficientItems.createOnUpdateArchiveV2(fs)),
  };
};
