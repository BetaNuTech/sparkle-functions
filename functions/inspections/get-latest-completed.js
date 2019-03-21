const express = require('express');
const cors = require('cors');
const moment = require('moment');
const log = require('./utils/logger');

const LOG_PREFIX = 'inspections: get-latest-completed:';

/**
 * Factory for getting the latest completed inspection
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth service instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetLatestCompletedInspection(db, auth) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Lookup the latest completed inspection for a property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const getlatestCompletedInspectionHandler = (req, res) => {
    var propertyCode = req.params.property;
    var other_date = req.query.other_date;
    var dateForInspection, otherDate;

    if (other_date) {
      otherDate = new Date(other_date);
      dateForInspection = otherDate.getTime() / 1000;
    }

    log.info(`${LOG_PREFIX} requesting latest completed inspection of cobalt code: ${propertyCode}`);

    db.ref('properties').orderByChild('code').equalTo(propertyCode).once('value').then(propertySnapshot => {
      if (!propertySnapshot.exists()) {
        res.status(404).send('code lookup, not found.');
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
        db.ref('inspections').orderByChild('property').equalTo(propertyKey).once('value').then(inspectionsSnapshot => {
          var latestInspection;
          var latestInspectionKey;
          var latestInspectionByDate;
          var latestInspectionByDateKey;
          var templateNameSubStringLookup = 'Blueshift Product Inspection'
          if (!inspectionsSnapshot.exists()) {
            res.status(404).send('no inspections exist yet.');
            return;
          } else if (inspectionsSnapshot.hasChildren()) {
            var inspections = [];
            inspectionsSnapshot.forEach(function(childSnapshot) {
              // key will be 'ada' the first time and 'alan' the second time
              var inspection = childSnapshot.val();
              var key = childSnapshot.key;
              // childData will be the actual contents of the child
              //var childData = childSnapshot.val();
              if (inspection.inspectionCompleted) {
                console.log(propertyCode, ' - Completed Inspection Template Name: ', inspection.template.name);
              }
              if (inspection.inspectionCompleted && inspection.template.name.indexOf(templateNameSubStringLookup) > -1) {
                inspections.push({'inspection':inspection, 'key':key});
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
            res.status(200).send(responseData);
          } else {
            res.status(404).send('No completed inspections exist yet.');
          }

        }).catch(function(error) {
          // Handle any errors
          console.log(error);
          res.status(500).send('No inspections found.');
        });
      }
    }).catch(function(error) {
      // Handle any errors
      console.log(error);
      res.status(500).send('Unable to retrieve data');
    });
  };

  // Create express app with single endpoint
  // that configures a required url param
  const app = express();
  app.use(cors());
  app.get('/:cobalt_code', authUser(db, auth), getlatestCompletedInspectionHandler);
  return app;
}

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
      alert = 'Blueshift Product Inspection OVERDUE (Last: ';
      alert = alert + moment(latestInspection.creationDate*1000).format('MM/DD/YY');
      alert = alert + ', Completed: ';
      alert = alert + moment(latestInspection.completionDate*1000).format('MM/DD/YY');
      alert = alert + ').';
      if ((completionDate_day - creationDate_day) > 3) {
        alert = alert + ' Over 3-day max duration, please start and complete inspection within 3 days.';
      }
      complianceAlert = alert;
    } else {
      alert = 'Blueshift Product Inspection OVERDUE (Last: ';
      alert = alert + moment(latestInspection.creationDate*1000).format('MM/DD/YY');
      alert = alert + ').';
      complianceAlert = alert;
    }
  }
  if (score < 90) { // Less than 30 days ago, but Score less than 90%?
    if (alert) {
      alert = alert + ' POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    } else {
      alert = 'POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    }
  }
  var inspectionURL = 'https://sparkle-production.herokuapp.com/properties/' + propertyKey + '/update-inspection/' + latestInspectionKey;
  var responseData = { 'creationDate': moment(latestInspection.creationDate*1000).format('MM/DD/YY'), 'score': score + '%', 'inspectionReportURL': latestInspection.inspectionReportURL, 'alert': alert, 'complianceAlert': complianceAlert, 'inspectionURL': inspectionURL};
  if (latestInspection.completionDate) {
    responseData = { 'creationDate': moment(latestInspection.creationDate*1000).format('MM/DD/YY'), 'completionDate': moment(latestInspection.completionDate*1000).format('MM/DD/YY'), 'score': score + '%', 'inspectionReportURL': latestInspection.inspectionReportURL, 'alert': alert, 'complianceAlert': complianceAlert, 'inspectionURL': inspectionURL};
  }

  console.log(responseData);
  return responseData;
}
