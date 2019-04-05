const functions = require('firebase-functions');
const admin = require('firebase-admin');
const templateCategories = require('./template-categories');
const pushMessages = require('./push-messages');
const templates = require('./templates');
const inspections = require('./inspections');
const properties = require('./properties');
const propertyTemplates = require('./property-templates');
const deficientItems = require('./deficient-items');
const regTokens = require('./reg-tokens');

const config = functions.config().firebase;
const defaultApp = admin.initializeApp(config);
const db = defaultApp.database();
const auth = admin.auth();
const storage = admin.storage();

// Staging
const functionsStagingDatabase = functions.database.instance('staging-sapphire-inspections');
const dbStaging = defaultApp.database('https://staging-sapphire-inspections.firebaseio.com');

// Send API version
exports.latestVersion = functions.https.onRequest((request, response) =>
  response.status(200).send({ios: '1.1.0'})
);


// Latest Completed Inspections
exports.latestCompleteInspection = functions.https.onRequest(
  inspections.getLatestCompleted(db)
);
exports.latestCompleteInspectionStaging = functions.https.onRequest(
  inspections.getLatestCompleted(dbStaging)
);


// Default Database Functions
exports.sendPushMessage = functions.database.ref('/sendMessages/{messageId}').onWrite(
  pushMessages.createOnWriteHandler(db, admin.messaging())
);
exports.sendPushMessageStaging = functionsStagingDatabase.ref('/sendMessages/{messageId}').onWrite(
  pushMessages.createOnWriteHandler(dbStaging, admin.messaging())
);


// POST /sendMessages
exports.createSendMessages = functions.https.onRequest(
  pushMessages.onCreateRequestHandler(db, auth)
);
exports.createSendMessagesStaging = functions.https.onRequest(
  pushMessages.onCreateRequestHandler(dbStaging, auth)
);


// For migrating to a new architecture only, setting a newer date
// This allow the updatedLastDate to stay as-is (make sure client doesn't update it though)
exports.inspectionMigrationDateWrite = functions.database.ref('/inspections/{inspectionId}/migrationDate').onWrite(
  inspections.createOnAttributeWriteHandler(db)
);
exports.inspectionMigrationDateWriteStaging = functionsStagingDatabase.ref('/inspections/{inspectionId}/migrationDate').onWrite(
  inspections.createOnAttributeWriteHandler(dbStaging)
);


// Property templates onWrite
exports.propertyTemplatesWrite = functions.database.ref('/properties/{propertyId}/templates').onWrite(
  properties.createOnTemplatesWriteHandler(db)
);
exports.propertyTemplatesWriteStaging = functionsStagingDatabase.ref('/properties/{propertyId}/templates').onWrite(
  properties.createOnTemplatesWriteHandler(dbStaging)
);


// Property onWrite
exports.propertyWrite = functions.database.ref('/properties/{propertyId}').onWrite(
  properties.createOnWriteHandler(db)
);
exports.propertyWriteStaging = functionsStagingDatabase.ref('/properties/{propertyId}').onWrite(
  properties.createOnWriteHandler(dbStaging)
);


// Property onDelete
exports.propertyDelete = functions.database.ref('/properties/{propertyId}').onDelete(
  properties.createOnDeleteHandler(db, storage)
);
exports.propertyDeleteStaging = functionsStagingDatabase.ref('/properties/{propertyId}').onDelete(
  properties.createOnDeleteHandler(dbStaging, storage)
);


// Deficient Items
exports.deficientItemsWrite = functions.database.ref('/inspections/{inspectionId}/updatedLastDate').onWrite(
  deficientItems.createOnInspectionWrite(db)
);
exports.deficientItemsWriteStaging = functionsStagingDatabase.ref('/inspections/{inspectionId}/updatedLastDate').onWrite(
  deficientItems.createOnInspectionWrite(dbStaging)
);

exports.deficientItemsPropertyMetaSync = functions.database.ref('/propertyInspectionDeficientItems/{propertyId}/{inspectionId}/{itemId}/state').onUpdate(
  deficientItems.createOnDiStateUpdate(db)
);
exports.deficientItemsPropertyMetaSyncStaging = functionsStagingDatabase.ref('/propertyInspectionDeficientItems/{propertyId}/{inspectionId}/{itemId}/state').onUpdate(
  deficientItems.createOnDiStateUpdate(dbStaging)
);


// Template onWrite
exports.templateWrite = functions.database.ref('/templates/{templateId}').onWrite(
  templates.createOnWriteHandler(db)
);
exports.templateWriteStaging = functionsStagingDatabase.ref('/templates/{templateId}').onWrite(
  templates.createOnWriteHandler(dbStaging)
);


// Inspection updatedLastDate onWrite
exports.inspectionUpdatedLastDateWrite = functions.database.ref('/inspections/{inspectionId}/updatedLastDate').onWrite(
  inspections.createOnAttributeWriteHandler(db)
);
exports.inspectionUpdatedLastDateWriteStaging = functionsStagingDatabase.ref('/inspections/{inspectionId}/updatedLastDate').onWrite(
  inspections.createOnAttributeWriteHandler(dbStaging)
);


// Inspection onWrite
exports.inspectionWrite = functions.database.ref('/inspections/{inspectionId}').onWrite(
  inspections.createOnWriteHandler(db)
);
exports.inspectionWriteStaging = functionsStagingDatabase.ref('/inspections/{inspectionId}').onWrite(
  inspections.createOnWriteHandler(dbStaging)
);


// Inspection onDelete
exports.inspectionDelete = functions.database.ref('/inspections/{inspectionId}').onDelete(
  inspections.createOnDeleteHandler(db, storage)
);
exports.inspectionDeleteStaging = functionsStagingDatabase.ref('/inspections/{inspectionId}').onDelete(
  inspections.createOnDeleteHandler(dbStaging, storage)
);


// Template Category Delete
exports.templateCategoryDelete = functions.database.ref('/templateCategories/{categoryId}').onDelete(
  templateCategories.createOnDeleteHandler(db)
);
exports.templateCategoryDeleteStaging = functionsStagingDatabase.ref('/templateCategories/{categoryId}').onDelete(
  templateCategories.createOnDeleteHandler(dbStaging)
);


// GET Inspection PDF Report
exports.inspectionPdfReport = functions.https.onRequest(
  inspections.createOnGetPDFReportHandler(db, admin.messaging(), auth)
);
exports.inspectionPdfReportStaging = functions.https.onRequest(
  inspections.createOnGetPDFReportHandler(dbStaging, admin.messaging(), auth)
);


// Message Subscribers
exports.propertyMetaSync = properties.cron.createSyncMeta('properties-sync', functions.pubsub, db);
exports.propertyMetaSyncStaging = properties.cron.createSyncMeta('staging-properties-sync', functions.pubsub, dbStaging);

exports.pushMessageSync = pushMessages.createCRONHandler('push-messages-sync', functions.pubsub, db, admin.messaging());
exports.pushMessageSyncStaging = pushMessages.createCRONHandler('staging-push-messages-sync', functions.pubsub, dbStaging, admin.messaging());

exports.templatesListSync = templates.cron.syncTemplatesList('templates-sync', functions.pubsub, db);
exports.templatesListSyncStaging = templates.cron.syncTemplatesList('staging-templates-sync', functions.pubsub, dbStaging);

exports.propertyTemplatesListSync = templates.cron.syncPropertyTemplatesList('templates-sync', functions.pubsub, db);
exports.propertyTemplatesListSyncStaging = templates.cron.syncPropertyTemplatesList('staging-templates-sync', functions.pubsub, dbStaging);

exports.propertyInspectionsListSync = inspections.cron.syncPropertyInspectionproxies('inspections-sync', functions.pubsub, db);
exports.propertyInspectionsListSyncStaging = inspections.cron.syncPropertyInspectionproxies('staging-inspections-sync', functions.pubsub, dbStaging);

exports.completedInspectionsListSync = inspections.cron.syncCompletedInspectionproxies('inspections-sync', functions.pubsub, db);
exports.completedInspectionsListSyncStaging = inspections.cron.syncCompletedInspectionproxies('staging-inspections-sync', functions.pubsub, dbStaging);

exports.cleanupInspectionProxyOrphansSync = inspections.cron.cleanupProxyOrphans('inspections-sync', functions.pubsub, db);
exports.cleanupInspectionProxyOrphansSyncStaging = inspections.cron.cleanupProxyOrphans('staging-inspections-sync', functions.pubsub, dbStaging);

exports.regTokensSync = regTokens.cron.syncOutdated('registration-tokens-sync', functions.pubsub, db);
exports.regTokensSyncStaging = regTokens.cron.syncOutdated('staging-registration-tokens-sync', functions.pubsub, dbStaging);

exports.deficientItemsOverdueSync = deficientItems.cron.createSyncOverdue('deficient-items-sync', functions.pubsub, db);
exports.deficientItemsOverdueSyncStaging = deficientItems.cron.createSyncOverdue('staging-deficient-items-sync', functions.pubsub, dbStaging);
