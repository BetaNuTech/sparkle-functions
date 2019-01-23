const functions = require('firebase-functions');
const moment = require('moment');

const admin = require('firebase-admin');
const log = require('./utils/logger');
const templateCategories = require('./template-categories');
var config = functions.config().firebase;
var defaultApp = admin.initializeApp(config);

var db = defaultApp.database();

// Staging
var functionsStagingDatabase = functions.database.instance('staging-sapphire-inspections');
var dbStaging = defaultApp.database('https://staging-sapphire-inspections.firebaseio.com')

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

exports.sendPushMessage = functions.database.ref('/sendMessages/{objectId}').onWrite((change,event) => {
    // Exit when the data is deleted.
    if (!change.after.exists()) {
        return false;
    }

    var pushMessage = change.after.val();
    var recipientId = pushMessage.recipientId;
    var objectId = event.params.objectId;

    return admin.database().ref('/registrationTokens').child(recipientId).once('value')
        .then(function(dataSnapshot) {
            // handle read data.
            if (dataSnapshot.exists()) {
                // These registration tokens come from the client FCM SDKs.
                var registrationTokens = [];
                if (dataSnapshot.hasChildren()) {
                    dataSnapshot.forEach(function(childSnapshot) {
                        // key will be "ada" the first time and "alan" the second time
                        var key = childSnapshot.key;
                        // childData will be the actual contents of the child
                        //var childData = childSnapshot.val();
                        registrationTokens.push(childSnapshot.key)
                    });
                } else {
                    //var data = dataSnapshot.val();
                    registrationTokens.push(dataSnapshot.key);
                }

                // See the "Defining the message payload" section above for details
                // on how to define a message payload.
                var payload = {
                    notification: {
                        title: pushMessage.title,
                        body: pushMessage.message,
                        icon: 'https://s3.us-east-2.amazonaws.com/sapphireinspections/assets/app_icon_192.png'
                    }
                };

                // Set the message as high priority and have it expire after 24 hours.
                // var options = {
                //   priority: "high",
                //   timeToLive: 60 * 60 * 24
                // };

                // Send a message to the device corresponding to the provided
                // registration token with the provided options.
                return admin.messaging().sendToDevice(registrationTokens, payload, {})
                .then(function(response) {
                    log.info("Successfully sent message:", response);
                })
                .catch(function(error) {
                    log.error("Error sending message:", error);
                })
                .then(function() {
                    admin.database().ref('/sendMessages').child(objectId).remove();
                });
            }
    });
});

// For migrating to a new architecture only, setting a newer date
// This allow the updatedLastDate to stay as-is (make sure client doesn't update it though)
exports.inspectionMigrationDateWrite = functions.database.ref('/inspections/{objectId}/migrationDate').onWrite((change, event) => {
    var objectId = event.params.objectId;
    if (!change.after.exists()) {
        console.log('migrationDate updated, but inspection deleted');
        return;
    }

    if (change.before.val() !== change.after.val()) {
        return change.after.ref.parent.once('value').then(function(inspectionSnapshot) {
            if (!inspectionSnapshot.exists()) {
                console.log('migrationDate updated, but no inspection value found');
                return;
            }

            console.log('migrationDate updated, calling processInspectionWrite()');
            var inspection = inspectionSnapshot.val();
            return processInspectionWrite(db, objectId, inspection);
        }).catch(function(error) {
            // Handle any errors
            console.error("Unable to access updated inspection", error);
            return;
        });
    }
});

// Property templates onWrite
exports.propertyTemplatesWrite = functions.database.ref('/properties/{objectId}/templates').onWrite((change,event) => {
    var propertyId = event.params.objectId;
    const adminDb = admin.database();

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
        log.info('all templates removed');
        var templatesRemoved = change.before.val();
        if (templatesRemoved != null) {
            return Promise.all(Object.keys(templatesRemoved).map(templateKey =>
                adminDb.ref('/propertyTemplates').child(propertyId).child(templateKey).remove()
                  .then(() => ({ [`/propertyTemplates/${propertyId}/${templateKey}`]: 'removed' }))
            ))
              .then(result => {
                const updates = {};
                result.forEach(update => Object.assign(updates, update));
                return updates;
              });
        }

        return Promise.resolve({});
    }

    var templatesPrevious = null;
    if (change.before.exists()) {
        templatesPrevious = change.before.val();
    }
    var templatesCurrent = change.after.val();

    // Find removed templates and remove them
    if (templatesPrevious != null) {
        var templatesRemoved = findTemplatesRemoved(templatesPrevious, templatesCurrent); // Array of template keys
        if (templatesRemoved.length > 0) {
            log.info('templates removed count: ', templatesRemoved.length);
            templatesRemoved.forEach(function(templateKey) {
                adminDb.ref('/propertyTemplates').child(propertyId).child(templateKey).remove();
            });
        }
    }

    return processTemplatesWrite(adminDb, propertyId, templatesCurrent);
});

// Property onWrite
exports.propertyWrite = functions.database.ref('/properties/{objectId}').onWrite((change,event) => {
    var propertyId = event.params.objectId;
    const adminDb = admin.database();

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
        log.info('property removed');
        var templatesRemoved = change.before.val().templates;
        if (templatesRemoved != null) {
            return Promise.all(Object.keys(templatesRemoved).map(templateKey =>
                adminDb.ref('/propertyTemplates').child(propertyId).child(templateKey).remove()
                  .then(() => ({ [`/propertyTemplates/${propertyId}/${templateKey}`]: 'removed' }))
            ))
              .then(result => {
                const updates = {};
                result.forEach(update => Object.assign(updates, update));
                return updates;
              });
        }

        return Promise.resolve({});
    }

    var templatesPrevious = null;
    if (change.before.exists()) {
        templatesPrevious = change.before.val().templates;
    }
    var templatesCurrent = change.after.val().templates;

    // Find removed templates and remove them
    if (templatesPrevious != null) {
        var templatesRemoved = findTemplatesRemoved(templatesPrevious, templatesCurrent); // Array of template keys
        if (templatesRemoved.length > 0) {
            log.info('templates removed count: ', templatesRemoved.length);
            templatesRemoved.forEach(function(templateKey) {
                adminDb.ref('/propertyTemplates').child(propertyId).child(templateKey).remove();
            });
        }
    }

    return processTemplatesWrite(adminDb, propertyId, templatesCurrent);
});

// Template onWrite
exports.templateWrite = functions.database.ref('/templates/{objectId}').onWrite((change,event) => {
    var templateId = event.params.objectId;
    const adminDb = admin.database();

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
        log.info('template removed');
        return removeTemplateInPropertyTemplates(adminDb, templateId);
    }

    return updateTemplateInPropertyTemplates(adminDb, templateId, change.after.val());
});

// Inspection updatedLastDate onWrite
exports.inspectionUpdatedLastDateWrite = functions.database.ref('/inspections/{objectId}/updatedLastDate').onWrite((change,event) => {
    var objectId = event.params.objectId;
    const adminDb = admin.database();

    if (!change.after.exists()) {
        log.info('updatedLastDate updated, but inspection deleted');
        return Promise.resolve(null);
    }

    if (change.before.val() !== change.after.val()) {
        return change.after.ref.parent.once('value').then(function(inspectionSnapshot) {
            if (!inspectionSnapshot.exists()) {
                log.info('updatedLastDate updated, but no inspection value found');
                return null;
            }

            log.info('updatedLastDate updated, calling processInspectionWrite()');
            var inspection = inspectionSnapshot.val();
            return processInspectionWrite(adminDb, objectId, inspection);
        }).catch(function(error) {
            // Handle any errors
            log.error('Unable to access updated inspection', error);
            return error;
        });
    }
});

// exports.inspectionCreate = functions.database.ref('/inspections/{objectId}').onCreate(event => {
//     var objectId = event.params.objectId;

//     // When the data is created, or new root data added/deleted.
//     if (event.data.exists()) {
//         var inspection = event.data.current.val();
//         processInspectionWrite(inspection);
//     } else {
//         console.error("inspectionCreate: Inspection created, but data is missing");
//     }
// });

// Inspection onWrite
exports.inspectionWrite = functions.database.ref('/inspections/{objectId}').onWrite((change,event) => {
    var objectId = event.params.objectId;
    const adminDb = admin.database();
    const updates = {};

    // When the data is deleted.
    if (!change.after.exists()) {
        log.info('inspection deleted');
        var inspection = change.before.val();
        var propertyKey = inspection.property;

        if (!propertyKey) {
            log.error('property key missing');
            return Promise.resolve(updates);
        }

        if (inspection.inspectionCompleted) {
            updates[`/completedInspections/${objectId}`] = 'removed';
            adminDb.ref('/completedInspections').child(objectId).remove();
        }

        updates[`/properties/${propertyKey}/inspections/${objectId}`] = 'removed';
        adminDb.ref('/properties').child(propertyKey).child('inspections').child(objectId).remove();  // Need to remove
        updates[`/propertyInspections/${propertyKey}/inspections/${objectId}`] = 'removed';
        return adminDb.ref('/propertyInspections').child(propertyKey).child('inspections').child(objectId).remove()
          .then(() => updates);
    } else {
        var inspection = change.after.val();
        log.info('inspectionWrite: inspection created/updated, so calling processInspectionWrite()');
        return processInspectionWrite(adminDb, objectId, inspection);
    }
});



// Staging Database Functions

exports.sendPushMessageStaging = functionsStagingDatabase.ref('/sendMessages/{objectId}').onWrite((change,event) => {
    // Exit when the data is deleted.
    if (!change.after.exists()) {
        return;
    }

    var pushMessage = change.after.val();
    var recipientId = pushMessage.recipientId;
    var objectId = event.params.objectId;

    admin.database().ref('/registrationTokens').child(recipientId).once('value')
        .then(function(dataSnapshot) {
            // handle read data.
            if (dataSnapshot.exists()) {
                // These registration tokens come from the client FCM SDKs.
                var registrationTokens = [];
                if (dataSnapshot.hasChildren()) {
                    dataSnapshot.forEach(function(childSnapshot) {
                        // key will be "ada" the first time and "alan" the second time
                        var key = childSnapshot.key;
                        // childData will be the actual contents of the child
                        //var childData = childSnapshot.val();
                        registrationTokens.push(childSnapshot.key)
                    });
                } else {
                    //var data = dataSnapshot.val();
                    registrationTokens.push(dataSnapshot.key);
                }

                // See the "Defining the message payload" section above for details
                // on how to define a message payload.
                var payload = {
                    notification: {
                        title: pushMessage.title,
                        body: pushMessage.message,
                        icon: 'https://s3.us-east-2.amazonaws.com/sapphireinspections/assets/app_icon_192.png'
                    }
                };

                // Set the message as high priority and have it expire after 24 hours.
                // var options = {
                //   priority: "high",
                //   timeToLive: 60 * 60 * 24
                // };

                // Send a message to the device corresponding to the provided
                // registration token with the provided options.
                admin.messaging().sendToDevice(registrationTokens, payload, {})
                .then(function(response) {
                    console.log("Successfully sent message:", response);
                    admin.database().ref('/sendMessages').child(objectId).remove();
                })
                .catch(function(error) {
                    console.error("Error sending message:", error);
                    admin.database().ref('/sendMessages').child(objectId).remove();
                });
            }
    });
});

// For migrating to a new architecture only, setting a newer date
// This allow the updatedLastDate to stay as-is (make sure client doesn't update it though)
exports.inspectionMigrationDateWriteStaging = functionsStagingDatabase.ref('/inspections/{objectId}/migrationDate').onWrite((change, event) => {
    var objectId = event.params.objectId;
    if (!change.after.exists()) {
        console.log('migrationDate updated, but inspection deleted');
        return;
    }

    if (change.before.val() !== change.after.val()) {
        return change.after.ref.parent.once('value').then(function(inspectionSnapshot) {
            if (!inspectionSnapshot.exists()) {
                console.log('migrationDate updated, but no inspection value found');
                return;
            }

            console.log('migrationDate updated, calling processInspectionWrite()');
            var inspection = inspectionSnapshot.val();
            return processInspectionWrite(dbStaging, objectId, inspection);
        }).catch(function(error) {
            // Handle any errors
            console.error("Unable to access updated inspection", error);
            return;
        });
    }
});

// Property templates onWrite
exports.propertyTemplatesWriteStaging = functionsStagingDatabase.ref('/properties/{objectId}/templates').onWrite((change,event) => {
    var propertyId = event.params.objectId;

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
        console.log('all templates removed');
        var templatesRemoved = change.before.val();
        if (templatesRemoved != null) {
            return Object.keys(templatesRemoved).forEach(function(templateKey) {
                dbStaging.ref('/propertyTemplates').child(propertyId).child(templateKey).remove();
            });
        }

        return;
    }

    var templatesPrevious = null;
    if (change.before.exists()) {
        templatesPrevious = change.before.val();
    }
    var templatesCurrent = change.after.val();

    // Find removed templates and remove them
    if (templatesPrevious != null) {
        var templatesRemoved = findTemplatesRemoved(templatesPrevious, templatesCurrent); // Array of template keys
        if (templatesRemoved.length > 0) {
            console.log('templates removed count: ', templatesRemoved.length);
            templatesRemoved.forEach(function(templateKey) {
                dbStaging.ref('/propertyTemplates').child(propertyId).child(templateKey).remove();
            });
        }
    }

    return processTemplatesWrite(dbStaging, propertyId, templatesCurrent);
});

// Property onWrite
exports.propertyWriteStaging = functionsStagingDatabase.ref('/properties/{objectId}').onWrite((change,event) => {
    var propertyId = event.params.objectId;

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
        console.log('property removed');
        var templatesRemoved = change.before.val().templates;
        if (templatesRemoved != null) {
            return Object.keys(templatesRemoved).forEach(function(templateKey) {
                dbStaging.ref('/propertyTemplates').child(propertyId).child(templateKey).remove();
            });
        }

        return;
    }

    var templatesPrevious = null;
    if (change.before.exists()) {
        templatesPrevious = change.before.val().templates;
    }
    var templatesCurrent = change.after.val().templates;

    // Find removed templates and remove them
    if (templatesPrevious != null) {
        var templatesRemoved = findTemplatesRemoved(templatesPrevious, templatesCurrent); // Array of template keys
        if (templatesRemoved.length > 0) {
            console.log('templates removed count: ', templatesRemoved.length);
            templatesRemoved.forEach(function(templateKey) {
                dbStaging.ref('/propertyTemplates').child(propertyId).child(templateKey).remove();
            });
        }
    }

    return processTemplatesWrite(dbStaging, propertyId, templatesCurrent);
});

// Template onWrite
exports.templateWriteStaging = functionsStagingDatabase.ref('/templates/{objectId}').onWrite((change,event) => {
    var templateId = event.params.objectId;

    // Delete onWrite event?
    if (change.before.exists() && !change.after.exists()) {
        console.log('template removed');
        return removeTemplateInPropertyTemplates(dbStaging, templateId);
    }

    return updateTemplateInPropertyTemplates(dbStaging, templateId, change.after.val());
});

// Inspection updatedLastDate onWrite
exports.inspectionUpdatedLastDateWriteStaging = functionsStagingDatabase.ref('/inspections/{objectId}/updatedLastDate').onWrite((change,event) => {
    var objectId = event.params.objectId;
    if (!change.after.exists()) {
        console.log('updatedLastDate updated, but inspection deleted');
        return;
    }

    if (change.before.val() !== change.after.val()) {
        return change.after.ref.parent.once('value').then(function(inspectionSnapshot) {
            if (!inspectionSnapshot.exists()) {
                console.log('updatedLastDate updated, but no inspection value found');
                return;
            }

            console.log('updatedLastDate updated, calling processInspectionWrite()');
            var inspection = inspectionSnapshot.val();
            return processInspectionWrite(dbStaging, objectId, inspection);
        }).catch(function(error) {
            // Handle any errors
            console.error("Unable to access updated inspection", error);
            return;
        });
    }
});

// Inspection onWrite
exports.inspectionWriteStaging = functionsStagingDatabase.ref('/inspections/{objectId}').onWrite((change,event) => {
    var objectId = event.params.objectId;

    // When the data is deleted.
    if (!change.after.exists()) {
        console.log('inspection deleted');
        var inspection = change.before.val();
        var propertyKey = inspection.property;

        if (!propertyKey) {
            console.error('property key missing');
            return;
        }

        if (inspection.inspectionCompleted) {
            dbStaging.ref('/completedInspections').child(objectId).remove();
        }

        dbStaging.ref('/properties').child(propertyKey).child('inspections').child(objectId).remove();  // Need to remove
        return dbStaging.ref('/propertyInspections').child(propertyKey).child('inspections').child(objectId).remove();
    } else {
        var inspection = change.after.val();
        console.log('inspectionWrite: inspection created/updated, so calling processInspectionWrite()');
        return processInspectionWrite(dbStaging, objectId, inspection);
    }
});



// Template Category Delete

exports.templateCategoryDelete = functions.database.ref('/templateCategories/{objectId}').onDelete(templateCategories.onDeleteHandler(db));
exports.templateCategoryDeleteStaging = functionsStagingDatabase.ref('/templateCategories/{objectId}').onDelete(templateCategories.onDeleteHandler(dbStaging));



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

function processInspectionWrite(database, objectId, inspection) {
    var propertyKey = inspection.property;
    const dbUpdates = {};

    if (!propertyKey) {
        log.error('processUpdatedInspection: property key missing');
        return Promise.resolve(dbUpdates);
    }

    var templateName = inspection.templateName;
    if (!templateName) {
        templateName = inspection.template.name;
    }

    // Update property/inspections
    var inspectionData = {
        'inspector': inspection.inspector,
        'inspectorName': inspection.inspectorName,
        'creationDate': inspection.creationDate,
        'updatedLastDate': inspection.updatedLastDate,
        'templateName': templateName,
        'score': inspection.score,
        'deficienciesExist': inspection.deficienciesExist,
        'inspectionCompleted': inspection.inspectionCompleted,
        'itemsCompleted': inspection.itemsCompleted,
        'totalItems': inspection.totalItems
    };
    database.ref('/properties').child(propertyKey).child('inspections').child(objectId).set(inspectionData);  // Need to remove
    dbUpdates[`/properties/${propertyKey}/inspections/${objectId}`] = inspectionData;
    database.ref('/propertyInspections').child(propertyKey).child('inspections').child(objectId).set(inspectionData);
    dbUpdates[`/propertyInspections/${propertyKey}/inspections/${objectId}`] = inspectionData;

    if (inspection.inspectionCompleted) {
        const completedInspectionData = {
            'inspector': inspection.inspector,
            'inspectorName': inspection.inspectorName,
            'creationDate': inspection.creationDate,
            'updatedLastDate': inspection.updatedLastDate,
            'templateName': templateName,
            'score': inspection.score,
            'deficienciesExist': inspection.deficienciesExist,
            'inspectionCompleted': inspection.inspectionCompleted,
            'property': inspection.property
        };
        database.ref('/completedInspections').child(objectId).set(completedInspectionData);
        dbUpdates[`/completedInspections/${objectId}`] = completedInspectionData;
    } else {
        database.ref('/completedInspections').child(objectId).remove();
        dbUpdates[`/completedInspections/${objectId}`] = 'removed';
    }

    // Pull all inspections for the same property
    return database.ref("/inspections").orderByChild("property").equalTo(propertyKey).once("value").then(inspectionsSnapshot => {
        var latestInspection;
        var numOfInspectionsCompleted = 0;
        if (!inspectionsSnapshot.exists()) {
            return dbUpdates;
        } else if (inspectionsSnapshot.hasChildren()) {
            var inspections = [];
            inspectionsSnapshot.forEach(function(childSnapshot) {
                // key will be "ada" the first time and "alan" the second time
                var inspection = childSnapshot.val();
                // childData will be the actual contents of the child
                //var childData = childSnapshot.val();
                if (inspection.inspectionCompleted) {
                    inspections.push(inspection);
                    numOfInspectionsCompleted++;
                }
            });

            if (inspections.length > 0) {
                var sortedInspections = inspections.sort(function(a,b) { return b.creationDate-a.creationDate });  // DESC
                latestInspection = sortedInspections[0];
            }
        } else {
            var inspection = inspectionsSnapshot.val();
            if (inspection.inspectionCompleted) {
                latestInspection = inspection;
                numOfInspectionsCompleted++;
            }
        }

        // Update numOfInspections for the property
        log.info('property numOfInspections updated');
        database.ref('/properties').child(propertyKey).update({'numOfInspections': numOfInspectionsCompleted});
        dbUpdates[`/properties/${propertyKey}/numOfInspections`] = numOfInspectionsCompleted

        if (latestInspection) {
            var updates = {};
            updates['lastInspectionScore'] = latestInspection.score;
            updates['lastInspectionDate'] = latestInspection.creationDate;
            log.info('property lastInspectionScore & lastInspectionDate updated');
            database.ref('/properties').child(propertyKey).update(updates);
            dbUpdates[`/properties/${propertyKey}`] = updates;
        }
        return dbUpdates;
    }).catch(function(error) {
        // Handle any errors
        log.error('Unable to access inspections', error);
        return null;
    });
};

function processTemplatesWrite(database, propertyId, templatesHash) {
    if (templatesHash != null) {
        const updates = {};
        log.info('Writing to /propertyTemplates/', propertyId, ' with count: ', Object.keys(templatesHash).length);
        Object.keys(templatesHash).forEach(function(templateKey) {
            database.ref('/templates').child(templateKey).once('value').then(function(templateSnapshot) {
                if (templateSnapshot.exists()) {
                    var template = templateSnapshot.val(); // Assumed hash data, with no children
                    var templateCopy = {};
                    templateCopy['name'] = template.name;
                    if (templateCopy['name'] == null) {
                        templateCopy['name'] = '';
                    }
                    templateCopy['description'] = template.description;
                    if (templateCopy['description'] == null) {
                        templateCopy['description'] = '';
                    }
                    database.ref('/propertyTemplates').child(propertyId).child(templateKey).set(templateCopy);
                    updates[`/propertyTemplates/${propertyId}/${templateKey}`] = 'upserted';
                }
            });
        });

        // Check updated propertyTemplates to remove templates that shouldn't be there
        return database.ref('/propertyTemplates').child(propertyId).once('value').then(function(templatesSnapshot) {
            if (templatesSnapshot.exists()) {
                var templatesRemoved = findTemplatesRemoved(templatesSnapshot.val(), templatesHash); // Array of template keys
                if (templatesRemoved.length > 0) {
                    log.info('templates removed count: ', templatesRemoved.length);
                    return Promise.all(templatesRemoved.map(templateKey =>
                        database.ref('/propertyTemplates').child(propertyId).child(templateKey).remove()
                          .then(() => {
                            updates[`/propertyTemplates/${propertyId}/${templateKey}`] = 'removed';
                          })
                    ));
                }
            }
        }).then(() => updates);
    }

    return [];
};

function removeTemplateInPropertyTemplates(database, templateId) {
    return database.ref('/propertyTemplates').once('value').then(function(propertyTemplatesSnapshot) {
        if (propertyTemplatesSnapshot.exists()) {
            var propertyTemplates = propertyTemplatesSnapshot.val();
            return Promise.all(Object.keys(propertyTemplates).map(propertyId => {
                if (propertyTemplates[propertyId][templateId] != null) {
                    return database.ref('/propertyTemplates').child(propertyId).child(templateId).remove()
                      .then(() => {
                        log.info('template removed /propertyTemplates/', propertyId);
                        return { [`/propertyTemplates/${propertyId}/${templateId}`]: 'removed' }
                      })
                }
                return Promise.resolve({});
            }))
              .then(result => {
                const updates = {};
                result.forEach(update => Object.assign(updates, update));
                return updates;
              });
        }

        return Promise.resolve({});
    });
};

function updateTemplateInPropertyTemplates(database, templateId, template) {
    var templateCopy = {};
    templateCopy['name'] = template.name;
    if (templateCopy['name'] == null) {
        templateCopy['name'] = '';
    }
    templateCopy['description'] = template.description;
    if (templateCopy['description'] == null) {
        templateCopy['description'] = '';
    }

    return database.ref('/propertyTemplates').once('value').then(function(propertyTemplatesSnapshot) {
        if (propertyTemplatesSnapshot.exists()) {
            var propertyTemplates = propertyTemplatesSnapshot.val();
            return Promise.all(Object.keys(propertyTemplates).map(function(propertyId) {
                if (propertyTemplates[propertyId][templateId] != null) {
                    return database.ref('/propertyTemplates').child(propertyId).child(templateId).set(templateCopy)
                      .then(() => {
                        log.info('template updated at /propertyTemplates/', propertyId, '/', templateId);
                        return { [`/propertyTemplates/${propertyId}/${templateId}`]: 'updated' }
                      })
                }
                return Promise.resolve({});
            }))
              .then(result => {
                const updates = {};
                result.forEach(update => Object.assign(updates, update));
                return updates;
              });
        }

        return Promise.resolve({});
    });
};

function findTemplatesRemoved(prev, current) {
    var templateKeysRemoved = [];
    Object.keys(prev).forEach(function(templateKey) {
        if (current == null || current[templateKey] == null) {
            templateKeysRemoved.push(templateKey);
        }
    });

    return templateKeysRemoved;
};

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
