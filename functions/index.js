const functions = require('firebase-functions');
const admin = require('firebase-admin');
const PubSub = require('@google-cloud/pubsub');
const templateCategories = require('./template-categories');
const inspections = require('./inspections');
const properties = require('./properties');
const deficiency = require('./deficient-items');
const teams = require('./teams');
const notifications = require('./notifications');
const regTokens = require('./reg-tokens');
const config = require('./config');
const createRouter = require('./router');

const { firebase: firebaseConfig } = config;
admin.initializeApp(firebaseConfig);
const fs = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();
const pubsubClient = new PubSub({
  projectId: firebaseConfig ? firebaseConfig.projectId : '',
});

exports.deficientItemsPropertyMetaSyncV2 = functions
  .runWith({ timeoutSeconds: 240, memory: '1GB' })
  .firestore.document('deficiencies/{deficiencyId}')
  .onUpdate(
    deficiency.createOnUpdateStateV2(
      fs,
      pubsubClient,
      'deficient-item-status-update'
    )
  );

exports.deficientItemsArchivingV2 = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(deficiency.createOnUpdateArchiveV2(fs));

exports.deficientItemsUnarchivingV2 = functions.firestore
  .document('archives/{deficiencyId}')
  .onUpdate(deficiency.createOnUpdateArchiveV2(fs));

exports.deficientItemsProgressNotesSyncV2 = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(deficiency.onUpdateProgressNoteV2(fs));

exports.deficiencyUpdateCompletedPhotos = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(deficiency.onUpdateCompletedPhotoV2(fs));

exports.templateCategoryDelete = functions.firestore
  .document('/templateCategories/{categoryId}')
  .onDelete(templateCategories.watchers.onDelete(fs));

exports.propertyDeleteV2 = functions.firestore
  .document('/properties/{propertyId}')
  .onDelete(properties.onDeleteWatcherV2(fs, storage));

exports.propertyWriteV2 = functions.firestore
  .document('/properties/{propertyId}')
  .onWrite(properties.onWriteV2(fs));

exports.inspectionDeleteV2 = functions.firestore
  .document('/inspections/{inspectionId}')
  .onDelete(inspections.onDeleteV2(fs));

exports.inspectionWriteV2 = functions
  .runWith({ memory: '1GB' })
  .firestore.document('/inspections/{inspectionId}')
  .onWrite(inspections.onWriteV2(fs));

exports.teamDeleteV2 = functions.firestore
  .document('/teams/{teamId}')
  .onDelete(teams.onDeleteV2(fs));

exports.createNotification = functions.firestore
  .document('/notifications/{notificationId}')
  .onCreate(
    notifications.onCreate(
      fs,
      pubsubClient,
      'notifications-slack-sync',
      'push-messages-sync'
    )
  );

// Message Subscribers

exports.regTokensSync = regTokens.pubsub.createSyncOutdated(
  fs,
  functions.pubsub,
  'registration-tokens-sync'
);

exports.deficiencyTrelloCardStateComments = deficiency.pubsub.trelloCardStateComment(
  fs,
  functions.pubsub,
  'deficient-item-status-update'
);

exports.deficiencyTrelloCardClose = deficiency.pubsub.trelloCardClose(
  fs,
  functions.pubsub,
  'deficient-item-status-update'
);

exports.deficiencyTrelloCardDueDates = deficiency.pubsub.trelloCardDueDate(
  fs,
  functions.pubsub,
  'deficient-item-status-update'
);

exports.deficiencySyncOverdue = deficiency.pubsub.syncOverdue(
  fs,
  functions.pubsub,
  'deficient-items-sync'
);

exports.publishSlackNotificationsV2 = notifications.pubsub.publishSlack(
  fs,
  functions.pubsub,
  'notifications-slack-sync'
);

exports.publishPushNotificationsV2 = notifications.pubsub.publishPush(
  fs,
  functions.pubsub,
  'push-messages-sync',
  messaging
);

exports.cleanupNotificationsV2 = notifications.pubsub.cleanPublished(
  fs,
  functions.pubsub,
  'notifications-sync'
);

// HTTPS Router API

exports.api = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(
    createRouter(fs, auth, {
      inspectionUrl: config.clientApps.web.inspectionURL,
    })
  );
