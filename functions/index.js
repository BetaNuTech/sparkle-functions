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
exports.upsertTrelloToken = functions.https.onRequest(
  trello.createOnUpsertTrelloTokenHandler(db, auth)
);

// DELETE /integrations/trello/authorization
exports.deleteTrelloAuthorization = functions.https.onRequest(
  trello.createDeleteTrelloAuthHandler(db, auth)
);

// GET /integrations/trello/{propertyId}/boards
exports.getAllTrelloBoards = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardsHandler(db, auth)
);

// GET /integrations/trello/{propertyId}/boards/{boardId}/lists
exports.getAllTrelloBoardLists = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardListsHandler(db, auth)
);

// POST /properties/:propertyId/deficient-items/:deficientItemId/trello/card
exports.createTrelloDeficientItemCard = functions.https.onRequest(
  trello.createOnTrelloDeficientItemCardHandler(
    db,
    auth,
    config.clientApps.web.deficientItemURL
  )
);

// POST /slackApp
exports.slackAppEvents = functions.https.onRequest(
  slack.createSlackEventsApiHandler(db)
);

// POST /integrations/slack/authorization
exports.createSlackAppAuth = functions.https.onRequest(
  slack.createOnSlackAppAuthHandler(db, auth)
);

// DELETE /integrations/slack/authorization
exports.deleteSlackAuthorization = functions.https.onRequest(
  slack.createDeleteSlackAppHandler(db, auth)
);

//  POST /notifications
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
    auth,
    config.clientApps.web.inspectionURL
  )
);

// For migrating to a new architecture only, setting a newer date
// This allow the updatedLastDate to stay as-is (make sure client doesn't update it though)
exports.inspectionMigrationDateWrite = functions.database
  .ref('/inspections/{inspectionId}/migrationDate')
  .onWrite(inspections.createOnWriteAttributeWatcher(db, fs));

// Property templates onWrite
exports.propertyTemplatesWrite = functions.database
  .ref('/properties/{propertyId}/templates')
  .onWrite(properties.createOnWriteTemplatesWatcher(db));

// Property onWrite
exports.propertyWrite = functions.database
  .ref('/properties/{propertyId}')
  .onWrite(properties.createOnWriteWatcher(db, fs));

// Property onDelete
exports.propertyDelete = functions.database
  .ref('/properties/{propertyId}')
  .onDelete(
    properties.createOnDeleteWatcher(
      db,
      fs,
      storage,
      pubsubClient,
      'user-teams-sync'
    )
  );

// Property team onWrite
exports.propertyTeamWrite = functions.database
  .ref('/properties/{propertyId}/team')
  .onWrite(
    properties.createOnWriteTeamsWatcher(db, pubsubClient, 'user-teams-sync')
  );

// Teams on write
exports.teamWrite = functions.database
  .ref('/teams/{teamId}')
  .onWrite(teams.onWrite(fs));

// Users teams onWrite
exports.userTeamWrite = functions.database
  .ref('/users/{userId}/teams/{teamId}')
  .onWrite(
    teams.createOnWriteUserTeamWatcher(db, pubsubClient, 'user-teams-sync')
  );

// teams onDelete
exports.teamDelete = functions.database
  .ref('/teams/{teamId}')
  .onDelete(teams.createOnDeleteWatcher(db, fs));

// Deficient Items
exports.deficientItemsWrite = functions.database
  .ref('/inspections/{inspectionId}/updatedAt')
  .onWrite(deficientItems.createOnWriteInspection(db, fs));

exports.deficientItemsPropertyMetaSync = functions.database
  .ref('/propertyInspectionDeficientItems/{propertyId}/{itemId}/state')
  .onUpdate(
    deficientItems.createOnUpdateState(
      db,
      fs,
      pubsubClient,
      'deficient-item-status-update'
    )
  );

exports.deficientItemsArchiving = functions.database
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/archive'
  )
  .onUpdate(deficientItems.createOnUpdateArchive(db, fs));

exports.deficientItemsUnarchiving = functions.database
  .ref(
    '/archive/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/archive'
  )
  .onUpdate(deficientItems.createOnUpdateArchive(db, fs));

// Template onWrite
exports.templateWrite = functions.database
  .ref('/templates/{templateId}')
  .onWrite(templates.createOnWriteWatcher(db, fs));

// Inspection updatedLastDate onWrite
exports.inspectionUpdatedLastDateWrite = functions.database
  .ref('/inspections/{inspectionId}/updatedLastDate')
  .onWrite(inspections.createOnWriteAttributeWatcher(db, fs));

// Inspection onCreate
exports.inspectionCreate = functions.database
  .ref('/inspections/{inspectionId}')
  .onCreate(inspections.onCreateWatcher(fs));

// Inspection onDelete
exports.inspectionDelete = functions.database
  .ref('/inspections/{inspectionId}')
  .onDelete(inspections.createOnDeleteWatcher(db, fs, storage));

// Template Category Delete
exports.templateCategoryDelete = functions.database
  .ref('/templateCategories/{categoryId}')
  .onDelete(templateCategories.createOnDeleteWatcher(db, fs));

// Template Category Create/Update
exports.templateCategoryWrite = functions.database
  .ref('/templateCategories/{categoryId}')
  .onWrite(templateCategories.onWrite(fs));

// Create Slack Notifications From Source
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

exports.publishSlackNotifications = notifications.pubsub.createPublishSlack(
  'notifications-slack-sync',
  functions.pubsub,
  db
);

exports.publishPushNotifications = notifications.pubsub.createPublishPush(
  'push-messages-sync',
  functions.pubsub,
  db,
  messaging
);

exports.cleanupNotifications = notifications.pubsub.createCleanup(
  db,
  functions.pubsub,
  pubsubClient,
  'notifications-sync',
  'push-messages-sync',
  'notifications-slack-sync'
);

exports.trelloCommentsForDefItemStateUpdates = trello.pubsub.createCommentForDiState(
  'deficient-item-status-update',
  functions.pubsub,
  db,
  fs
);

exports.trelloCardDueDateUpdates = trello.pubsub.createUpdateDueDate(
  'deficient-item-status-update',
  functions.pubsub,
  db,
  fs
);

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

const fsWatchers = firestoreWatchers(db, fs, pubsubClient);
Object.keys(fsWatchers).forEach(endpoint => {
  exports[endpoint] = fsWatchers[endpoint];
});
