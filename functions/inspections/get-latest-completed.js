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
    const propertyCode = req.params.property;
    const otherDate = req.query.other_date;
    const dateForInspection = otherDate ? new Date(otherDate).getTime() / 1000 : null;

    log.info(`${LOG_PREFIX} requesting latest completed inspection of cobalt code: ${propertyCode}`);

    db.ref('properties').orderByChild('code').equalTo(propertyCode).once('value').then(propertySnapshot => {
      if (!propertySnapshot.exists()) {
        return res.status(404).send('code lookup, not found.');
      }

      let propertyKey;
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
        let inspection;
        let responseData;
        let latestInspection;
        let latestInspectionKey;
        let latestInspectionByDate;
        let latestInspectionByDateKey;
        const templateNameSubStringLookup = 'Blueshift Product Inspection';
        if (!inspectionsSnapshot.exists()) {
          res.status(404).send('no inspections exist yet.');
          return;
        } else if (inspectionsSnapshot.hasChildren()) {
          const inspections = [];
          inspectionsSnapshot.forEach(function(childSnapshot) {
            // key will be 'ada' the first time and 'alan' the second time
            const insp = childSnapshot.val();
            const { key } = childSnapshot;

            // childData will be the actual contents of the child
            //var childData = childSnapshot.val();
            if (insp.inspectionCompleted) {
              console.log(`${propertyCode} - Completed Inspection Template Name: ${insp.template.name}`);
            }

            if (insp.inspectionCompleted && insp.template.name.indexOf(templateNameSubStringLookup) > -1) {
              inspections.push({inspection: insp, key});
            }
          });

          if (inspections.length > 0) {
            const sortedInspections = inspections.sort(function(a,b) { return b.inspection.creationDate-a.inspection.creationDate })  // DESC
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
          inspection = inspectionsSnapshot.val();
          if (inspection.inspectionCompleted && inspection.template.name.indexOf(templateNameSubStringLookup) > -1) {
            latestInspection = inspection;
            latestInspectionKey = inspectionsSnapshot.key;
          }
        }

        if (latestInspection) {
          responseData = latestInspectionResponseData(new Date(), propertyKey, latestInspection, latestInspectionKey);

          if (latestInspectionByDate) {
            responseData.latest_inspection_by_date = latestInspectionResponseData(new Date(otherDate), propertyKey, latestInspectionByDate, latestInspectionByDateKey);
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
  const currentTimeSecs = date.getTime() / 1000;
  const currentDay = currentTimeSecs / 60 / 60 / 24;
  const creationDateDay = latestInspection.creationDate / 60 / 60 / 24; // Unixtime already
  const differenceDays = currentDay - creationDateDay;
  const score = Math.round(Number(latestInspection.score));
  const inspectionURL = `https://sparkle-production.herokuapp.com/properties/${propertyKey}/update-inspection/${latestInspectionKey}`;

  let alert;
  let responseData;
  let complianceAlert;
  let completionDateDay;

  // If completionDate exists, use it
  if (latestInspection.completionDate) {
    completionDateDay = latestInspection.completionDate / 60 / 60 / 24; // Unixtime already
    if ((currentDay - completionDateDay) > 3) {
      differenceDays = currentDay - (creationDateDay + 3);
    } else {
      differenceDays = currentDay - completionDateDay;
    }
  }

  console.log(`Days since last inspection = ${differenceDays}`);

  if (differenceDays > 7) {
    if (latestInspection.completionDate) { // 10 days or more old
      completionDateDay = latestInspection.completionDate / 60 / 60 / 24; // Unixtime already
      alert = [
        'Blueshift Product Inspection OVERDUE (Last: ',
        moment(latestInspection.creationDate * 1000).format('MM/DD/YY'),
        ', Completed: ',
        moment(latestInspection.completionDate * 1000).format('MM/DD/YY'),
        ').'
      ].join('');

      if ((completionDateDay - creationDateDay) > 3) {
        alert += ' Over 3-day max duration, please start and complete inspection within 3 days.';
      }

      complianceAlert = alert;
    } else {
      alert = [
        'Blueshift Product Inspection OVERDUE (Last: ',
        moment(latestInspection.creationDate * 1000).format('MM/DD/YY'),
        ').'
      ].join('');
      complianceAlert = alert;
    }
  }

  // Less than 30 days ago, but Score less than 90%?
  if (score < 90) {
    if (alert) {
      alert += ' POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    } else {
      alert = 'POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    }
  }

  responseData = { creationDate: moment(latestInspection.creationDate * 1000).format('MM/DD/YY'), score: `${score}%`, inspectionReportURL: latestInspection.inspectionReportURL, alert, complianceAlert, inspectionURL};

  if (latestInspection.completionDate) {
    responseData = { creationDate: moment(latestInspection.creationDate * 1000).format('MM/DD/YY'), completionDate: moment(latestInspection.completionDate * 1000).format('MM/DD/YY'), score: `${score}%`, inspectionReportURL: latestInspection.inspectionReportURL, alert, complianceAlert, inspectionURL};
  }

  console.log(responseData);
  return responseData;
}
