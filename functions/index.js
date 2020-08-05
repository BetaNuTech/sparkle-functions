const functions = require('firebase-functions');
const admin = require('firebase-admin');
const PubSub = require('@google-cloud/pubsub');
const templateCategories = require('./template-categories');
const inspections = require('./inspections');
const properties = require('./properties');
const deficiency = require('./deficient-items');
const teams = require('./teams');
const trello = require('./trello');
const slack = require('./slack');
const notifications = require('./notifications');
const regTokens = require('./reg-tokens');
const config = require('./config');
const versions = require('./versions');
const createRouter = require('./router');
const firestoreWatchers = require('./firestore-watchers');

const { firebase: firebaseConfig } = config;
const defaultApp = admin.initializeApp(firebaseConfig);
const db = defaultApp.database();
const fs = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();
const pubsubClient = new PubSub({
  projectId: firebaseConfig ? firebaseConfig.projectId : '',
});

// Send API version
exports.latestVersion = functions.https.onRequest(
  versions.api.getClientAppVersions(fs)
);

exports.deficientItemsPropertyMetaSyncV2 = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(
    deficiency.createOnUpdateStateV2(
      fs,
      pubsubClient,
      'deficient-item-status-update'
    )
  );

exports.deficientItemsArchivingV2 = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(deficiency.createOnUpdateArchiveV2(db, fs));

exports.deficientItemsUnarchivingV2 = functions.firestore
  .document('archives/{deficiencyId}')
  .onUpdate(deficiency.createOnUpdateArchiveV2(db, fs));

exports.deficientItemsProgressNotesSyncV2 = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(deficiency.onUpdateProgressNoteV2(fs));

exports.deficiencyUpdateCompletedPhotos = functions.firestore
  .document('deficiencies/{deficiencyId}')
  .onUpdate(deficiency.onUpdateCompletedPhotoV2(fs));

exports.templateCategoryDeleteV2 = functions.firestore
  .document('/templateCategories/{categoryId}')
  .onDelete(templateCategories.createOnDeleteWatcherV2(fs));

exports.propertyDeleteV2 = functions.firestore
  .document('/properties/{propertyId}')
  .onDelete(properties.onDeleteWatcherV2(fs, storage));

exports.propertyWriteV2 = functions.firestore
  .document('/properties/{propertyId}')
  .onWrite(properties.onWriteV2(fs));

exports.inspectionDeleteV2 = functions.firestore
  .document('/inspections/{inspectionId}')
  .onDelete(inspections.onDeleteV2(db, fs));

exports.inspectionWriteV2 = functions.firestore
  .document('/inspections/{inspectionId}')
  .onWrite(inspections.onWriteV2(db, fs));

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
exports.propertyMetaSync = properties.pubsub.createSyncMeta(
  'properties-sync',
  functions.pubsub,
  db,
  fs
);

exports.regTokensSync = regTokens.pubsub.createSyncOutdated(
  'registration-tokens-sync',
  functions.pubsub,
  db
);

exports.teamsSync = teams.pubsub.createSyncTeam(
  'teams-sync',
  functions.pubsub,
  db,
  fs
);

exports.userTeamsSync = teams.pubsub.createSyncUserTeam(
  'user-teams-sync',
  functions.pubsub,
  db,
  fs
);

// API

exports.api = functions.https.onRequest(
  createRouter(db, fs, auth, {
    inspectionUrl: config.clientApps.web.inspectionURL,
  })
);

// Firestore Watchers

const fsWatchers = firestoreWatchers(
  db,
  fs,
  pubsubClient,
  storage,
  functions.pubsub,
  messaging
);
Object.keys(fsWatchers).forEach(endpoint => {
  exports[endpoint] = fsWatchers[endpoint];
});
