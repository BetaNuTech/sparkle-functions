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
const config = require('./config');

const { firebase: firebaseConfig } = config;
const defaultApp = admin.initializeApp(firebaseConfig);
const db = defaultApp.database();
const auth = admin.auth();
const storage = admin.storage();
const messaging = admin.messaging();
const pubsubClient = new PubSub({
  projectId: firebaseConfig ? firebaseConfig.projectId : '',
});

// Staging
const functionsStagingDatabase = functions.database.instance(
  firebaseConfig.stagingDatabaseName
);
const dbStaging = defaultApp.database(firebaseConfig.stagingDatabaseURL);

// Send API version
exports.latestVersion = functions.https.onRequest((request, response) =>
  response.status(200).send({ ios: '1.5.0' })
);

// Latest Completed Inspections
exports.latestCompleteInspection = functions.https.onRequest(
  inspections.getLatestCompleted(db)
);
exports.latestCompleteInspectionStaging = functions.https.onRequest(
  inspections.getLatestCompleted(dbStaging)
);

// POST /integrations/trello/authorization
exports.upsertTrelloToken = functions.https.onRequest(
  trello.createOnUpsertTrelloTokenHandler(db, auth)
);
exports.upsertTrelloTokenStaging = functions.https.onRequest(
  trello.createOnUpsertTrelloTokenHandler(dbStaging, auth)
);

// DELETE /integrations/trello/authorization
exports.deleteTrelloAuthorization = functions.https.onRequest(
  trello.createDeleteTrelloAuthHandler(db, auth)
);
exports.deleteTrelloAuthorizationStaging = functions.https.onRequest(
  trello.createDeleteTrelloAuthHandler(dbStaging, auth)
);

// GET /integrations/trello/{propertyId}/boards
exports.getAllTrelloBoards = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardsHandler(db, auth)
);
exports.getAllTrelloBoardsStaging = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardsHandler(dbStaging, auth)
);

// GET /integrations/trello/{propertyId}/boards/{boardId}/lists
exports.getAllTrelloBoardLists = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardListsHandler(db, auth)
);
exports.getAllTrelloBoardListsStaging = functions.https.onRequest(
  trello.createOnGetAllTrelloBoardListsHandler(dbStaging, auth)
);

// POST /properties/:propertyId/deficient-items/:deficientItemId/trello/card
exports.createTrelloDeficientItemCard = functions.https.onRequest(
  trello.createOnTrelloDeficientItemCardHandler(
    db,
    auth,
    config.clientApps.web.productionDeficientItemURL
  )
);
exports.createTrelloDeficientItemCardStaging = functions.https.onRequest(
  trello.createOnTrelloDeficientItemCardHandler(
    dbStaging,
    auth,
    config.clientApps.web.stagingDeficientItemURL
  )
);

// POST /integrations/slack/authorization
exports.createSlackAppAuth = functions.https.onRequest(
  slack.createOnSlackAppAuthHandler(db, auth)
);
exports.createSlackAppAuthStaging = functions.https.onRequest(
  slack.createOnSlackAppAuthHandler(dbStaging, auth)
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
exports.createSlackNotificationsStaging = functions.https.onRequest(
  slack.createOnSlackNotificationHandler(
    dbStaging,
    auth,
    pubsubClient,
    'staging-notifications-sync'
  )
);

// GET Inspection PDF Report
exports.inspectionPdfReport = functions.https.onRequest(
  inspections.createOnGetPDFReportHandler(db, auth)
);
exports.inspectionPdfReportStaging = functions.https.onRequest(
  inspections.createOnGetPDFReportHandler(dbStaging, auth)
);

// For migrating to a new architecture only, setting a newer date
// This allow the updatedLastDate to stay as-is (make sure client doesn't update it though)
exports.inspectionMigrationDateWrite = functions.database
  .ref('/inspections/{inspectionId}/migrationDate')
  .onWrite(inspections.createOnWriteAttributeWatcher(db));
exports.inspectionMigrationDateWriteStaging = functionsStagingDatabase
  .ref('/inspections/{inspectionId}/migrationDate')
  .onWrite(inspections.createOnWriteAttributeWatcher(dbStaging));

// Property templates onWrite
exports.propertyTemplatesWrite = functions.database
  .ref('/properties/{propertyId}/templates')
  .onWrite(properties.createOnWriteTemplatesWatcher(db));
exports.propertyTemplatesWriteStaging = functionsStagingDatabase
  .ref('/properties/{propertyId}/templates')
  .onWrite(properties.createOnWriteTemplatesWatcher(dbStaging));

// Property onWrite
exports.propertyWrite = functions.database
  .ref('/properties/{propertyId}')
  .onWrite(properties.createOnWriteWatcher(db));
exports.propertyWriteStaging = functionsStagingDatabase
  .ref('/properties/{propertyId}')
  .onWrite(properties.createOnWriteWatcher(dbStaging));

// Property onDelete
exports.propertyDelete = functions.database
  .ref('/properties/{propertyId}')
  .onDelete(
    properties.createOnDeleteWatcher(
      db,
      storage,
      pubsubClient,
      'user-teams-sync'
    )
  );
exports.propertyDeleteStaging = functionsStagingDatabase
  .ref('/properties/{propertyId}')
  .onDelete(
    properties.createOnDeleteWatcher(
      dbStaging,
      storage,
      pubsubClient,
      'staging-user-teams-sync'
    )
  );

// Property team onWrite
exports.propertyTeamWrite = functions.database
  .ref('/properties/{propertyId}/team')
  .onWrite(
    properties.createOnWriteTeamsWatcher(db, pubsubClient, 'user-teams-sync')
  );
exports.propertyTeamWriteStaging = functionsStagingDatabase
  .ref('/properties/{propertyId}/team')
  .onWrite(
    properties.createOnWriteTeamsWatcher(
      dbStaging,
      pubsubClient,
      'staging-user-teams-sync'
    )
  );

// Users teams onWrite
exports.userTeamWrite = functions.database
  .ref('/users/{userId}/teams/{teamId}')
  .onWrite(
    teams.createOnWriteUserTeamWatcher(db, pubsubClient, 'user-teams-sync')
  );
exports.userTeamWriteStaging = functionsStagingDatabase
  .ref('/users/{userId}/teams/{teamId}')
  .onWrite(
    teams.createOnWriteUserTeamWatcher(
      dbStaging,
      pubsubClient,
      'staging-user-teams-sync'
    )
  );

// teams onDelete
exports.teamDelete = functions.database
  .ref('/teams/{teamId}')
  .onDelete(teams.createOnDeleteWatcher(db));
exports.teamDeleteStaging = functionsStagingDatabase
  .ref('/teams/{teamId}')
  .onDelete(teams.createOnDeleteWatcher(dbStaging));

// Deficient Items
exports.deficientItemsWrite = functions.database
  .ref('/inspections/{inspectionId}/updatedAt')
  .onWrite(deficientItems.createOnWriteInspection(db));
exports.deficientItemsWriteStaging = functionsStagingDatabase
  .ref('/inspections/{inspectionId}/updatedAt')
  .onWrite(deficientItems.createOnWriteInspection(dbStaging));

exports.deficientItemsPropertyMetaSync = functions.database
  .ref('/propertyInspectionDeficientItems/{propertyId}/{itemId}/state')
  .onUpdate(
    deficientItems.createOnUpdateState(
      db,
      pubsubClient,
      'deficient-item-status-update'
    )
  );
exports.deficientItemsPropertyMetaSyncStaging = functionsStagingDatabase
  .ref('/propertyInspectionDeficientItems/{propertyId}/{itemId}/state')
  .onUpdate(
    deficientItems.createOnUpdateState(
      dbStaging,
      pubsubClient,
      'staging-deficient-item-status-update'
    )
  );

exports.deficientItemsArchiving = functions.database
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/archive'
  )
  .onUpdate(deficientItems.createOnUpdateArchive(db));
exports.deficientItemsArchivingStaging = functionsStagingDatabase
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/archive'
  )
  .onUpdate(deficientItems.createOnUpdateArchive(dbStaging));

exports.deficientItemsUnarchiving = functions.database
  .ref(
    '/archive/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/archive'
  )
  .onUpdate(deficientItems.createOnUpdateArchive(db));
exports.deficientItemsUnarchivingStaging = functionsStagingDatabase
  .ref(
    '/archive/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/archive'
  )
  .onUpdate(deficientItems.createOnUpdateArchive(dbStaging));

// Template onWrite
exports.templateWrite = functions.database
  .ref('/templates/{templateId}')
  .onWrite(templates.createOnWriteWatcher(db));
exports.templateWriteStaging = functionsStagingDatabase
  .ref('/templates/{templateId}')
  .onWrite(templates.createOnWriteWatcher(dbStaging));

// Inspection updatedLastDate onWrite
exports.inspectionUpdatedLastDateWrite = functions.database
  .ref('/inspections/{inspectionId}/updatedLastDate')
  .onWrite(inspections.createOnWriteAttributeWatcher(db));
exports.inspectionUpdatedLastDateWriteStaging = functionsStagingDatabase
  .ref('/inspections/{inspectionId}/updatedLastDate')
  .onWrite(inspections.createOnWriteAttributeWatcher(dbStaging));

// Inspection onWrite
exports.inspectionWrite = functions.database
  .ref('/inspections/{inspectionId}')
  .onWrite(inspections.createOnWriteWatcher(db));
exports.inspectionWriteStaging = functionsStagingDatabase
  .ref('/inspections/{inspectionId}')
  .onWrite(inspections.createOnWriteWatcher(dbStaging));

// Inspection onDelete
exports.inspectionDelete = functions.database
  .ref('/inspections/{inspectionId}')
  .onDelete(inspections.createOnDeleteWatcher(db, storage));
exports.inspectionDeleteStaging = functionsStagingDatabase
  .ref('/inspections/{inspectionId}')
  .onDelete(inspections.createOnDeleteWatcher(dbStaging, storage));

// Template Category Delete
exports.templateCategoryDelete = functions.database
  .ref('/templateCategories/{categoryId}')
  .onDelete(templateCategories.createOnDeleteWatcher(db));
exports.templateCategoryDeleteStaging = functionsStagingDatabase
  .ref('/templateCategories/{categoryId}')
  .onDelete(templateCategories.createOnDeleteWatcher(dbStaging));

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
exports.onCreateSourceSlackNotificationStaging = functionsStagingDatabase
  .ref('/notifications/src/{notificationId}')
  .onCreate(
    notifications.createOnCreateSrcSlackWatcher(
      dbStaging,
      pubsubClient,
      'staging-notifications-slack-sync'
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
exports.onCreateSourcePushNotificationStaging = functionsStagingDatabase
  .ref('/notifications/src/{notificationId}')
  .onCreate(
    notifications.createOnCreateSrcPushWatcher(
      dbStaging,
      pubsubClient,
      'staging-push-messages-sync'
    )
  );

exports.onCreateDeficientItemProgressNoteTrelloComment = functions.database
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/progressNotes/{progressNoteId}'
  )
  .onCreate(trello.createOnCreateDIProgressNote(db));

exports.onCreateDeficientItemProgressNoteTrelloCommentStaging = functionsStagingDatabase
  .ref(
    '/propertyInspectionDeficientItems/{propertyId}/{deficientItemId}/progressNotes/{progressNoteId}'
  )
  .onCreate(trello.createOnCreateDIProgressNote(dbStaging));

// Message Subscribers
exports.propertyMetaSync = properties.pubsub.createSyncMeta(
  'properties-sync',
  functions.pubsub,
  db
);
exports.propertyMetaSyncStaging = properties.pubsub.createSyncMeta(
  'staging-properties-sync',
  functions.pubsub,
  dbStaging
);

exports.templatesListSync = templates.pubsub.createSyncTemplatesList(
  'templates-sync',
  functions.pubsub,
  db
);
exports.templatesListSyncStaging = templates.pubsub.createSyncTemplatesList(
  'staging-templates-sync',
  functions.pubsub,
  dbStaging
);

exports.propertyTemplatesListSync = templates.pubsub.createSyncPropertyTemplatesList(
  'templates-sync',
  functions.pubsub,
  db
);
exports.propertyTemplatesListSyncStaging = templates.pubsub.createSyncPropertyTemplatesList(
  'staging-templates-sync',
  functions.pubsub,
  dbStaging
);

exports.propertyInspectionsListSync = inspections.pubsub.createSyncPropertyInspectionProxies(
  'inspections-sync',
  functions.pubsub,
  db
);
exports.propertyInspectionsListSyncStaging = inspections.pubsub.createSyncPropertyInspectionProxies(
  'staging-inspections-sync',
  functions.pubsub,
  dbStaging
);

exports.completedInspectionsListSync = inspections.pubsub.createSyncCompletedInspectionProxies(
  'inspections-sync',
  functions.pubsub,
  db
);
exports.completedInspectionsListSyncStaging = inspections.pubsub.createSyncCompletedInspectionProxies(
  'staging-inspections-sync',
  functions.pubsub,
  dbStaging
);

exports.cleanupInspectionProxyOrphansSync = inspections.pubsub.createCleanupProxyOrphans(
  'inspections-sync',
  functions.pubsub,
  db
);
exports.cleanupInspectionProxyOrphansSyncStaging = inspections.pubsub.createCleanupProxyOrphans(
  'staging-inspections-sync',
  functions.pubsub,
  dbStaging
);

exports.regTokensSync = regTokens.pubsub.createSyncOutdated(
  'registration-tokens-sync',
  functions.pubsub,
  db
);
exports.regTokensSyncStaging = regTokens.pubsub.createSyncOutdated(
  'staging-registration-tokens-sync',
  functions.pubsub,
  dbStaging
);

exports.deficientItemsOverdueSync = deficientItems.pubsub.createSyncOverdue(
  'deficient-items-sync',
  functions.pubsub,
  db
);
exports.deficientItemsOverdueSyncStaging = deficientItems.pubsub.createSyncOverdue(
  'staging-deficient-items-sync',
  functions.pubsub,
  dbStaging
);

exports.teamsSync = teams.pubsub.createSyncTeam(
  'teams-sync',
  functions.pubsub,
  db
);
exports.teamsSyncStaging = teams.pubsub.createSyncTeam(
  'staging-teams-sync',
  functions.pubsub,
  dbStaging
);

exports.userTeamsSync = teams.pubsub.createSyncUserTeam(
  'user-teams-sync',
  functions.pubsub,
  db
);
exports.userTeamsSyncStaging = teams.pubsub.createSyncUserTeam(
  'staging-user-teams-sync',
  functions.pubsub,
  dbStaging
);

exports.publishSlackNotifications = notifications.pubsub.createPublishSlack(
  'notifications-slack-sync',
  functions.pubsub,
  db
);

exports.publishSlackNotificationsStaging = notifications.pubsub.createPublishSlack(
  'staging-notifications-slack-sync',
  functions.pubsub,
  dbStaging
);

exports.publishPushNotifications = notifications.pubsub.createPublishPush(
  'push-messages-sync',
  functions.pubsub,
  db,
  messaging
);

exports.publishPushNotificationsStaging = notifications.pubsub.createPublishPush(
  'staging-push-messages-sync',
  functions.pubsub,
  dbStaging,
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

exports.cleanupNotificationsStaging = notifications.pubsub.createCleanup(
  dbStaging,
  functions.pubsub,
  pubsubClient,
  'staging-notifications-sync',
  'staging-push-messages-sync',
  'staging-notifications-slack-sync'
);

exports.trelloCommentsForDefItemStateUpdates = trello.pubsub.createCommentForDiState(
  'deficient-item-status-update',
  functions.pubsub,
  db
);

exports.trelloCommentsForDefItemStateUpdatesStaging = trello.pubsub.createCommentForDiState(
  'staging-deficient-item-status-update',
  functions.pubsub,
  dbStaging
);

exports.trelloCardDueDateUpdates = trello.pubsub.createUpdateDueDate(
  'deficient-item-status-update',
  functions.pubsub,
  db
);

exports.trelloCardDueDateUpdatesStaging = trello.pubsub.createUpdateDueDate(
  'staging-deficient-item-status-update',
  functions.pubsub,
  dbStaging
);

exports.trelloDiCardClose = trello.pubsub.createCloseDiCard(
  'deficient-item-status-update',
  functions.pubsub,
  db
);

exports.trelloDiCardCloseStaging = trello.pubsub.createCloseDiCard(
  'staging-deficient-item-status-update',
  functions.pubsub,
  dbStaging
);
