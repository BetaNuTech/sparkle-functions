const functions = require('firebase-functions');
const admin = require('firebase-admin');
const PubSub = require('@google-cloud/pubsub');
const templateCategories = require('./template-categories');
const templates = require('./templates');
const inspections = require('./inspections');
const properties = require('./properties');
const deficientItems = require('./deficient-items');
const teams = require('./teams');
const trello = require('./trello');
const slack = require('./slack');
const notifications = require('./notifications');
const regTokens = require('./reg-tokens');
const users = require('./users');
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

// Latest Completed Inspections
exports.latestCompleteInspection = functions.https.onRequest(
  inspections.getLatestCompleted(db)
);

// POST /integrations/trello/authorization
// DEPRECATED in favor of router
exports.upsertTrelloToken = functions.https.onRequest(
  trello.createOnUpsertTrelloTokenHandler(db, auth)
);

// DELETE /integrations/trello/authorization
// DEPRECATED in favor of router
exports.deleteTrelloAuthorization = functions.https.onRequest(
  trello.createDeleteTrelloAuthHandler(db, auth)
);

// GET /integrations/trello/{propertyId}/boards
// DEPRECATED: Remove when Firebase DB dropped
exports.getAllTrelloBoards = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardsHandler(db, auth)
);

// GET /integrations/trello/{propertyId}/boards/{boardId}/lists
// DEPRECATED: Remove when Firebase DB dropped
exports.getAllTrelloBoardLists = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardListsHandler(db, auth)
);

// POST /properties/:propertyId/deficient-items/:deficientItemId/trello/card
// DEPRECATED: in favor of router
exports.createTrelloDeficientItemCard = functions.https.onRequest(
  trello.createOnTrelloDeficientItemCardHandler(
    db,
    auth,
    config.clientApps.web.deficientItemURL
  )
);

// POST /slackApp
// DEPRECATED: Remove when Firebase DB dropped
exports.slackAppEvents = functions.https.onRequest(
  slack.slackEventsApiHandler(db)
);

// POST /integrations/slack/authorization
// NOTE: Deprecate when firebase db dropped
exports.createSlackAppAuth = functions.https.onRequest(
  slack.createOnSlackAppAuthHandler(db, auth)
);

// DELETE /integrations/slack/authorization
// NOTE: Deprecated: delete when firebase db dropped
exports.deleteSlackAuthorization = functions.https.onRequest(
  slack.createDeleteSlackAppHandler(db, auth)
);

//  POST /notifications
//  NOTE: Deprecated in favor of router API
exports.createSlackNotifications = functions.https.onRequest(
  slack.createOnSlackNotificationHandler(
    db,
    auth,
    pubsubClient,
    'notifications-sync'
  )
);

// GET Inspection PDF Report
exports.inspectionPdfReport = functions.https.onRequest(
  inspections.createOnGetPDFReportHandler(
    db,
    fs,
    auth,
    config.clientApps.web.inspectionURL
  )
);

// Create Slack Notifications From Source
// DEPRECATED
exports.onCreateSourceSlackNotification = functions.database
  .ref('/notifications/src/{notificationId}')
  .onCreate(
    notifications.createOnCreateSrcSlackWatcher(
      db,
      pubsubClient,
      'notifications-slack-sync'
    )
  );

// Create Push Notifications From Source
// DEPRECATED
exports.onCreateSourcePushNotification = functions.database
  .ref('/notifications/src/{notificationId}')
  .onCreate(
    notifications.createOnCreateSrcPushWatcher(
      db,
      pubsubClient,
      'push-messages-sync'
    )
  );

exports.onCreateDeficientItemProgressNoteTrelloComment = functions.database
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/progressNotes/{progressNoteId}'
  )
  .onCreate(trello.createOnCreateDIProgressNote(db, fs));

exports.onCreateDeficientItemCompletedPhotoTrelloAttachement = functions.database
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/completedPhotos/{completedPhotoId}'
  )
  .onCreate(trello.createOnCreateDICompletedPhoto(db, fs));

exports.userWrite = functions.database
  .ref('/users/{userId}')
  .onWrite(users.onWrite(fs));

// Message Subscribers
exports.propertyMetaSync = properties.pubsub.createSyncMeta(
  'properties-sync',
  functions.pubsub,
  db,
  fs
);

exports.templatesListSync = templates.pubsub.createSyncTemplatesList(
  'templates-sync',
  functions.pubsub,
  db,
  fs
);

exports.propertyTemplatesListSync = templates.pubsub.createSyncPropertyTemplatesList(
  'templates-sync',
  functions.pubsub,
  db
);

exports.propertyInspectionsListSync = inspections.pubsub.createSyncPropertyInspectionProxies(
  'inspections-sync',
  functions.pubsub,
  db
);

exports.completedInspectionsListSync = inspections.pubsub.createSyncCompletedInspectionProxies(
  'inspections-sync',
  functions.pubsub,
  db
);

exports.cleanupInspectionProxyOrphansSync = inspections.pubsub.createCleanupProxyOrphans(
  'inspections-sync',
  functions.pubsub,
  db
);

exports.regTokensSync = regTokens.pubsub.createSyncOutdated(
  'registration-tokens-sync',
  functions.pubsub,
  db
);

// DEPRECATED
exports.deficientItemsOverdueSync = deficientItems.pubsub.createSyncOverdue(
  'deficient-items-sync',
  functions.pubsub,
  db,
  fs,
  config.clientApps.web.deficientItemURL
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

// DEPRECATED
exports.publishSlackNotifications = notifications.pubsub.createPublishSlack(
  'notifications-slack-sync',
  functions.pubsub,
  db
);

// DEPRECATED
exports.publishPushNotifications = notifications.pubsub.createPublishPush(
  'push-messages-sync',
  functions.pubsub,
  db,
  messaging
);

// DEPRECATED
exports.cleanupNotifications = notifications.pubsub.createCleanup(
  db,
  functions.pubsub,
  pubsubClient,
  'notifications-sync',
  'push-messages-sync',
  'notifications-slack-sync'
);

// DEPRECATED
exports.trelloCommentsForDefItemStateUpdates = trello.pubsub.createCommentForDiState(
  'deficient-item-status-update',
  functions.pubsub,
  db,
  fs
);

// DEPRECATED
exports.trelloCardDueDateUpdates = trello.pubsub.createUpdateDueDate(
  'deficient-item-status-update',
  functions.pubsub,
  db,
  fs
);

// DEPRECATED
exports.trelloDiCardClose = trello.pubsub.createCloseDiCard(
  'deficient-item-status-update',
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
