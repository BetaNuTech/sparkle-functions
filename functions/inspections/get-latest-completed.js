const express = require('express');
const cors = require('cors');
const moment = require('moment');
const log = require('./utils/logger');

const LOG_PREFIX = 'inspections: get-latest-completed:';
const TEMP_NAME_LOOKUP = 'Blueshift Product Inspection';

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
  const getlatestCompletedInspectionHandler = async (req, res) => {
    const propertyCode = req.query.cobalt_code;
    const otherDate = req.query.other_date;
    const dateForInspection = otherDate ? new Date(otherDate).getTime() / 1000 : 0;

    log.info(`${LOG_PREFIX} requesting latest completed inspection of cobalt code: ${propertyCode}`);

    let propertySnapshot;
    try {
      propertySnapshot = await db.ref('properties').orderByChild('code').equalTo(propertyCode).once('value');
    } catch(e) {
      log.error(`${LOG_PREFIX} ${e}`);
      return retres.status(500).send('Unable to retrieve data');
    }

    if (!propertySnapshot.exists()) {
      return res.status(404).send('code lookup, not found.');
    }

    let propertyKey;
    if (propertySnapshot.hasChildren()) {
      propertySnapshot.forEach(childSnapshot => propertyKey = childSnapshot.key);
    } else {
      propertyKey = propertySnapshot.key
    }

    let inspectionsSnapshot;

    try {
      inspectionsSnapshot = await db.ref('inspections').orderByChild('property').equalTo(propertyKey).once('value');
    } catch (e) {
      // Handle any errors
      log.error(`${LOG_PREFIX} ${e}`);
      res.status(500).send('No inspections found.');
    }

    if (!inspectionsSnapshot.exists()) {
      return res.status(404).send('no inspections exist yet.');
    }

    const {
      latestInspection,
      latestInspectionKey,
      latestInspectionByDate,
      latestInspectionByDateKey
    } = findLatestInspectionData(inspectionsSnapshot, dateForInspection);

    if (latestInspection) {
      const responseData = latestInspectionResponseData(new Date(), propertyKey, latestInspection, latestInspectionKey);

      if (latestInspectionByDate) {
        responseData.latest_inspection_by_date = latestInspectionResponseData(new Date(otherDate), propertyKey, latestInspectionByDate, latestInspectionByDateKey);
      }

      res.status(200).send(responseData);
    } else {
      res.status(404).send('No completed inspections exist yet.');
    }
  };

  // Create express app with single endpoint
  // that configures a required url param
  const app = express();
  app.use(cors());
  app.get('/', authUser(db, auth), getlatestCompletedInspectionHandler);
  return app;
}

/**
 * Find latest inspection from inspections snapshot
 * - provide any available meta data about the latest inspection
 * @param  {firebase.DataSnapshot} inspectionsSnapshot
 * @param  {Number} dateForInspection
 * @return {Object}
 */
function findLatestInspectionData(inspectionsSnapshot, dateForInspection) {
  const result = {
    latestInspection: null,
    latestInspectionKey: null,
    latestInspectionByDate: null,
    latestInspectionByDateKey: null
  };
  const inspections = [];

  // Top level, single, inspection
  if (!inspectionsSnapshot.hasChildren()) {
    let inspection = inspectionsSnapshot.val();

    if (inspection.inspectionCompleted && inspection.template.name.indexOf(TEMP_NAME_LOOKUP) > -1) {
      result.latestInspection = inspection;
      result.latestInspectionKey = inspectionsSnapshot.key;
    }
  }

  // Has many inspections
  inspectionsSnapshot.forEach(childSnapshot => {
    // key will be 'ada' the first time and 'alan' the second time
    const insp = childSnapshot.val();
    const { key } = childSnapshot;

    if (insp.inspectionCompleted) {
      log.info(`${LOG_PREFIX} ${propertyCode} - Completed Inspection Template Name: ${insp.template.name}`);
    }

    if (insp.inspectionCompleted && insp.template.name.indexOf(TEMP_NAME_LOOKUP) > -1) {
      inspections.push({inspection: insp, key});
    }
  });

  if (inspections.length > 0) {
    const sortedInspections = inspections.sort((a, b) => b.inspection.creationDate - a.inspection.creationDate);  // DESC
    result.latestInspection = sortedInspections[0].inspection;
    result.latestInspectionKey = sortedInspections[0].key;

    // Latest Inspection by provided date
    if (dateForInspection) {
      sortedInspections.forEach(keyInspection => {
        if (!latestInspectionByDate && keyInspection.inspection.creationDate <= dateForInspection && keyInspection.inspection.completionDate <= dateForInspection) {
          result.latestInspectionByDate = keyInspection.inspection;
          result.latestInspectionByDateKey = keyInspection.key;
        }
      });
    }
  }

  return result;
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

  log.info(`${LOG_PREFIX} days since last inspection: ${differenceDays}`);

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

  return responseData;
}
