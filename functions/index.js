const functions = require('firebase-functions');
const moment = require('moment');
const admin = require('firebase-admin');
const log = require('./utils/logger');
const findRemovedKeys = require('./utils/find-removed-keys');
const templateCategories = require('./template-categories');
const pushMessages = require('./push-messages');
const templates = require('./templates');
const inspections = require('./inspections');
const properties = require('./properties');
const propertyTemplates = require('./property-templates');
const regTokens = require('./reg-tokens');
const config = functions.config().firebase;
const defaultApp = admin.initializeApp(config);

const db = defaultApp.database();
const auth = admin.auth();

// Staging
const functionsStagingDatabase = functions.database.instance('staging-sapphire-inspections');
const dbStaging = defaultApp.database('https://staging-sapphire-inspections.firebaseio.com');
const storage = admin.storage();

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

// exports.helloWorld = functions.https.onRequest((request, response) => {
//     response.send("Hello from Firebase!");
// });
// HTTPS Functions

exports.latestVersion = functions.https.onRequest((request, response) => {
    response.status(200).send({ "ios": "1.1.0"});
});

// exports.lastestInspectionTest = functions.https.onRequest((request, response) => {
//     var propertyCode = request.query.cobalt_code;
//     if (!propertyCode) {
//         response.status(400).send('Bad Request. Missing Parameters.');
//         return;
//     }

//     db.ref("properties").orderByChild("code").equalTo(propertyCode).once("value").then(propertySnapshot => {
//         response.status(200).send(propertySnapshot);
//     }).catch(function(error) {
//         // Handle any errors
//         response.status(500).send('Unable to retrieve data: ' + error);
//     });
// });

exports.latestCompleteInspection = functions.https.onRequest((request, response) => {
    var propertyCode = request.query.cobalt_code;
    var other_date = request.query.other_date;
    var dateForInspection;
    if (other_date) {
        var otherDate = new Date(other_date);
        dateForInspection = otherDate.getTime() / 1000;
    }
    if (!propertyCode) {
        response.status(400).send('Bad Request. Missing Parameters.');
        return;
    }

    db.ref("properties").orderByChild("code").equalTo(propertyCode).once("value").then(propertySnapshot => {
        if (!propertySnapshot.exists()) {
            response.status(404).send('code lookup, not found.');
            return;
        } else {
            var propertyKey;
            if (propertySnapshot.hasChildren()) {
                propertySnapshot.forEach(function(childSnapshot) {
                    propertyKey = childSnapshot.key;

                    // Cancel enumeration
                    return true;
                });
            } else {
                propertyKey = propertySnapshot.key
            }
            db.ref("inspections").orderByChild("property").equalTo(propertyKey).once("value").then(inspectionsSnapshot => {
                var latestInspection;
                var latestInspectionKey;
                var latestInspectionByDate;
                var latestInspectionByDateKey;
                var templateNameSubStringLookup = "Blueshift Product Inspection"
                if (!inspectionsSnapshot.exists()) {
                    response.status(404).send('no inspections exist yet.');
                    return;
                } else if (inspectionsSnapshot.hasChildren()) {
                    var inspections = [];
                    inspectionsSnapshot.forEach(function(childSnapshot) {
                        // key will be "ada" the first time and "alan" the second time
                        var inspection = childSnapshot.val();
                        var key = childSnapshot.key;
                        // childData will be the actual contents of the child
                        //var childData = childSnapshot.val();
                        if (inspection.inspectionCompleted) {
                            console.log(propertyCode, " - Completed Inspection Template Name: ", inspection.template.name);
                        }
                        if (inspection.inspectionCompleted && inspection.template.name.indexOf(templateNameSubStringLookup) > -1) {
                            inspections.push({"inspection":inspection, "key":key});
                        }
                    });

                    if (inspections.length > 0) {
                        var sortedInspections = inspections.sort(function(a,b) { return b.inspection.creationDate-a.inspection.creationDate })  // DESC
                        latestInspection = sortedInspections[0].inspection;
                        latestInspectionKey = sortedInspections[0].key;

                        // Latest Inspection by provided date
                        if (dateForInspection) {
                            sortedInspections.forEach(function(keyInspection) {
                                if (!latestInspectionByDate && keyInspection.inspection.creationDate <= dateForInspection && keyInspection.inspection.completionDate <= dateForInspection) {
                                    latestInspectionByDate = keyInspection.inspection;
                                    latestInspectionByDateKey = keyInspection.key;
                                }
                            });
                        }

                        // Remove inspection by date, if same inspection
                        // Alert could be different, so allowing both
                        // if (latestInspectionByDateKey && latestInspectionKey && latestInspectionKey == latestInspectionByDateKey) {
                        //     latestInspectionByDate = null;
                        //     latestInspectionByDateKey = null;
                        // }
                    }
                } else {
                    var inspection = inspectionsSnapshot.val();
                    if (inspection.inspectionCompleted && inspection.template.name.indexOf(templateNameSubStringLookup) > -1) {
                        latestInspection = inspection;
                        latestInspectionKey = inspectionsSnapshot.key;
                    }
                }

                if (latestInspection) {
                    var today = new Date();
                    var responseData = latestInspectionResponseData(today, propertyKey, latestInspection, latestInspectionKey);
                    if (latestInspectionByDate) {
                        var otherDate = new Date(other_date);
                        responseData['latest_inspection_by_date'] = latestInspectionResponseData(otherDate, propertyKey, latestInspectionByDate, latestInspectionByDateKey);
                    }
                    response.status(200).send(responseData);
                } else {
                    response.status(404).send('No completed inspections exist yet.');
                }

            }).catch(function(error) {
                // Handle any errors
                console.log(error);
                response.status(500).send('No inspections found.');
            });
        }
    }).catch(function(error) {
        // Handle any errors
        console.log(error);
        response.status(500).send('Unable to retrieve data');
    });
});



// Default Database Functions

exports.sendPushMessage = functions.database.ref('/sendMessages/{objectId}').onWrite(
  pushMessages.createOnWriteHandler(db, admin.messaging())
);

exports.sendPushMessageStaging = functionsStagingDatabase.ref('/sendMessages/{objectId}').onWrite(
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
exports.inspectionMigrationDateWrite = functions.database.ref('/inspections/{objectId}/migrationDate').onWrite(
  inspections.createOnAttributeWriteHandler(db)
);

exports.inspectionMigrationDateWriteStaging = functionsStagingDatabase.ref('/inspections/{objectId}/migrationDate').onWrite(
  inspections.createOnAttributeWriteHandler(dbStaging)
);


// Property templates onWrite
exports.propertyTemplatesWrite = functions.database.ref('/properties/{objectId}/templates').onWrite(
  properties.templatesOnWriteHandler(db)
);

exports.propertyTemplatesWriteStaging = functionsStagingDatabase.ref('/properties/{objectId}/templates').onWrite(
  properties.templatesOnWriteHandler(dbStaging)
);


// Property onWrite
exports.propertyWrite = functions.database.ref('/properties/{objectId}').onWrite(
  properties.createOnWriteHandler(db)
);

exports.propertyWriteStaging = functionsStagingDatabase.ref('/properties/{objectId}').onWrite(
  properties.createOnWriteHandler(dbStaging)
);


// Property onDelete
exports.propertyDelete = functions.database.ref('/properties/{propertyId}').onDelete(
  properties.createOnDeleteHandler(db, storage)
);

exports.propertyDeleteStaging = functionsStagingDatabase.ref('/properties/{propertyId}').onDelete(
  properties.createOnDeleteHandler(dbStaging, storage)
);


// Template onWrite
exports.templateWrite = functions.database.ref('/templates/{objectId}').onWrite(
  templates.createOnWriteHandler(db)
);

exports.templateWriteStaging = functionsStagingDatabase.ref('/templates/{objectId}').onWrite(
  templates.createOnWriteHandler(dbStaging)
);


// Inspection updatedLastDate onWrite
exports.inspectionUpdatedLastDateWrite = functions.database.ref('/inspections/{objectId}/updatedLastDate').onWrite(
  inspections.createOnAttributeWriteHandler(db)
);

exports.inspectionUpdatedLastDateWriteStaging = functionsStagingDatabase.ref('/inspections/{objectId}/updatedLastDate').onWrite(
  inspections.createOnAttributeWriteHandler(dbStaging)
);

// exports.inspectionCreate = functions.database.ref('/inspections/{objectId}').onCreate(event => {
//     var objectId = event.params.objectId;

//     // When the data is created, or new root data added/deleted.
//     if (event.data.exists()) {
//         var inspection = event.data.current.val();
//         inspections.processWrite(inspection);
//     } else {
//         console.error("inspectionCreate: Inspection created, but data is missing");
//     }
// });

// Inspection onWrite
exports.inspectionWrite = functions.database.ref('/inspections/{objectId}').onWrite(
  inspections.createOnWriteHandler(db)
);
exports.inspectionWriteStaging = functionsStagingDatabase.ref('/inspections/{objectId}').onWrite(
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

exports.templateCategoryDelete = functions.database.ref('/templateCategories/{objectId}').onDelete(
  templateCategories.onDeleteHandler(db)
);
exports.templateCategoryDeleteStaging = functionsStagingDatabase.ref('/templateCategories/{objectId}').onDelete(
  templateCategories.onDeleteHandler(dbStaging)
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

exports.cleanupProxyOrphansSync = inspections.cron.cleanupProxyOrphans('inspections-sync', functions.pubsub, db);
exports.cleanupProxyOrphansSyncStaging = inspections.cron.cleanupProxyOrphans('staging-inspections-sync', functions.pubsub, dbStaging);

exports.regTokensSync = regTokens.cron.syncOutdated('registration-tokens-sync', functions.pubsub, db);
exports.regTokensSyncStaging = regTokens.cron.syncOutdated('staging-registration-tokens-sync', functions.pubsub, dbStaging);

// Local Functions

function latestInspectionResponseData(date, propertyKey, latestInspection, latestInspectionKey) {
    var currentTime_secs = date.getTime() / 1000;
    var currentDay = currentTime_secs / 60 / 60 / 24;
    var creationDate_day = latestInspection.creationDate / 60 / 60 / 24; // Unixtime already
    var difference_days = currentDay - creationDate_day;
    // If completionDate exists, use it
    if (latestInspection.completionDate) {
        var completionDate_day = latestInspection.completionDate / 60 / 60 / 24; // Unixtime already
        if ((currentDay - completionDate_day) > 3) {
            difference_days = currentDay - (creationDate_day + 3);
        } else {
            difference_days = currentDay - completionDate_day;
        }
    }
    var score = Math.round(Number(latestInspection.score));
    var alert;
    var complianceAlert;
    console.log('Days since last inspection = ', difference_days);
    if (difference_days > 7) {
        if (latestInspection.completionDate) { // 10 days or more old
            var completionDate_day = latestInspection.completionDate / 60 / 60 / 24; // Unixtime already
            alert = "Blueshift Product Inspection OVERDUE (Last: ";
            alert = alert + moment(latestInspection.creationDate*1000).format("MM/DD/YY");
            alert = alert + ", Completed: ";
            alert = alert + moment(latestInspection.completionDate*1000).format("MM/DD/YY");
            alert = alert + ").";
            if ((completionDate_day - creationDate_day) > 3) {
                alert = alert + " Over 3-day max duration, please start and complete inspection within 3 days.";
            }
            complianceAlert = alert;
        } else {
            alert = "Blueshift Product Inspection OVERDUE (Last: ";
            alert = alert + moment(latestInspection.creationDate*1000).format("MM/DD/YY");
            alert = alert + ").";
            complianceAlert = alert;
        }
    }
    if (score < 90) { // Less than 30 days ago, but Score less than 90%?
        if (alert) {
            alert = alert + " POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!";
        } else {
            alert = "POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!";
        }
    }
    var inspectionURL = "https://sparkle-production.herokuapp.com/properties/" + propertyKey + "/update-inspection/" + latestInspectionKey;
    var responseData = { "creationDate": moment(latestInspection.creationDate*1000).format("MM/DD/YY"), "score": score + '%', "inspectionReportURL": latestInspection.inspectionReportURL, "alert": alert, "complianceAlert": complianceAlert, "inspectionURL": inspectionURL};
    if (latestInspection.completionDate) {
        responseData = { "creationDate": moment(latestInspection.creationDate*1000).format("MM/DD/YY"), "completionDate": moment(latestInspection.completionDate*1000).format("MM/DD/YY"), "score": score + '%', "inspectionReportURL": latestInspection.inspectionReportURL, "alert": alert, "complianceAlert": complianceAlert, "inspectionURL": inspectionURL};
    }

    console.log(responseData);
    return responseData;
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp * 1000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec ;
    return time;
};
