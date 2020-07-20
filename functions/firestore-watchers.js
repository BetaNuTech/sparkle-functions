const functions = require('firebase-functions');
const properties = require('./properties');
const teams = require('./teams');
const inspections = require('./inspections');
const deficiency = require('./deficient-items');
const templateCategories = require('./template-categories');
const notifications = require('./notifications');

module.exports = (
  db,
  fs,
  pubsubClient,
  storage,
  functionsPubSub,
  messaging
) => {
  return {
    deficientItemsPropertyMetaSyncV2: functions.firestore
      .document('deficiencies/{deficiencyId}')
      .onUpdate(
        deficiency.createOnUpdateStateV2(
          fs,
          pubsubClient,
          'deficient-item-status-update'
        )
      ),

    deficientItemsArchivingV2: functions.firestore
      .document('deficiencies/{deficiencyId}')
      .onUpdate(deficiency.createOnUpdateArchiveV2(db, fs)),

    deficientItemsUnarchivingV2: functions.firestore
      .document('archives/{deficiencyId}')
      .onUpdate(deficiency.createOnUpdateArchiveV2(db, fs)),

    deficientItemsProgressNotesSyncV2: functions.firestore
      .document('deficiencies/{deficiencyId}')
      .onUpdate(deficiency.onUpdateProgressNoteV2(fs)),

    // Replaces: onCreateDeficientItemCompletedPhotoTrelloAttachement
    deficiencyUpdateCompletedPhotos: functions.firestore
      .document('deficiencies/{deficiencyId}')
      .onUpdate(deficiency.onUpdateCompletedPhotoV2(fs)),

    // Replaces: trelloCommentsForDefItemStateUpdates
    deficiencyTrelloCardStateComments: deficiency.pubsub.trelloCardStateComment(
      fs,
      functions.pubsub,
      'deficient-item-status-update'
    ),

    // Replaces: trelloDiCardClose
    deficiencyTrelloCardClose: deficiency.pubsub.trelloCardClose(
      fs,
      functions.pubsub,
      'deficient-item-status-update'
    ),

    // Replaces: trelloCardDueDateUpdates
    deficiencyTrelloCardDueDates: deficiency.pubsub.trelloCardDueDate(
      fs,
      functions.pubsub,
      'deficient-item-status-update'
    ),

    // Replaces: deficientItemsOverdueSync
    deficiencySyncOverdue: deficiency.pubsub.syncOverdue(
      fs,
      functions.pubsub,
      'deficient-items-sync'
    ),

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
      .onDelete(inspections.onDeleteV2(db, fs)),

    inspectionWriteV2: functions.firestore
      .document('/inspections/{inspectionId}')
      .onWrite(inspections.onWriteV2(db, fs)),

    teamDeleteV2: functions.firestore
      .document('/teams/{teamId}')
      .onDelete(teams.onDeleteV2(fs)),

    createNotification: functions.firestore
      .document('/notifications/{notificationId}')
      .onCreate(
        notifications.onCreate(
          fs,
          pubsubClient,
          'notifications-slack-sync',
          'push-messages-sync'
        )
      ),

    // Replaces: publishSlackNotifications
    publishSlackNotificationsV2: notifications.pubsub.publishSlack(
      fs,
      functionsPubSub,
      'notifications-slack-sync'
    ),

    // REPLACES: publishPushNotifications
    publishPushNotificationsV2: notifications.pubsub.publishPush(
      fs,
      functionsPubSub,
      'push-messages-sync',
      messaging
    ),

    // Replaces: cleanupNotifications
    cleanupNotificationsV2: notifications.pubsub.cleanPublished(
      fs,
      functionsPubSub,
      'notifications-sync'
    ),
  };
};
