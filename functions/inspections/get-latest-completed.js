const assert = require('assert');
const express = require('express');
const cors = require('cors');
const moment = require('moment');
const log = require('../utils/logger');

const LOG_PREFIX = 'inspections: get-latest-completed:';
const TEMP_NAME_LOOKUP = 'Blueshift Product Inspection';

/**
 * Factory for getting the latest completed inspection
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetLatestCompletedInspection(db) {
  assert(Boolean(db), 'has firebase database instance');

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

    if (!propertyCode) {
      return res.status(400).send('Bad Request. Missing Parameters.');
    }

    log.info(`${LOG_PREFIX} requesting latest completed inspection of cobalt code: ${propertyCode}`);

    let propertySnap;
    try {
      propertySnap = await db.ref('properties').orderByChild('code').equalTo(propertyCode).limitToFirst(1).once('value');
    } catch(e) {
      log.error(`${LOG_PREFIX} ${e}`);
      return retres.status(500).send('Unable to retrieve data');
    }

    if (!propertySnap.exists()) {
      return res.status(404).send('code lookup, not found.');
    }

    // Get first and only property id from results
    const [propertyKey] = Object.keys(propertySnap.val());

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

    if (!latestInspection) {
      return res.status(404).send('No completed latest inspection found.');
    }

    // Successful response
    const responseData = latestInspectionResponseData(new Date(), propertyKey, latestInspection, latestInspectionKey);
    if (latestInspectionByDate) {
      responseData.latest_inspection_by_date = latestInspectionResponseData(new Date(otherDate), propertyKey, latestInspectionByDate, latestInspectionByDateKey);
    }

    res.status(200).send(responseData);
  };

  // Create express app with single endpoint
  // that configures a required url param
  const app = express();
  app.use(cors());
  app.get('/', getlatestCompletedInspectionHandler);
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
  // TODO: remove inspections snapshot always has children
  if (!inspectionsSnapshot.hasChildren()) {
    let inspection = inspectionsSnapshot.val();

    if (
      inspection.inspectionCompleted &&
      inspection.completionDate &&
      inspection.template.name.indexOf(TEMP_NAME_LOOKUP) > -1) {
      result.latestInspection = inspection;
      result.latestInspectionKey = inspectionsSnapshot.key;
    }
  }

  // Has many inspections
  inspectionsSnapshot.forEach(childSnapshot => {
    // key will be 'ada' the first time and 'alan' the second time
    const insp = childSnapshot.val();
    const { key } = childSnapshot;

    if (
      insp.inspectionCompleted &&
      insp.completionDate &&
      insp.template.name.indexOf(TEMP_NAME_LOOKUP) > -1) {
      inspections.push({inspection: insp, key});
    }
  });

  if (inspections.length > 0) {
    const sortedInspections = inspections.sort((a, b) => b.inspection.creationDate - a.inspection.creationDate);  // DESC
    result.latestInspection = sortedInspections[0].inspection;
    result.latestInspectionKey = sortedInspections[0].key;

    // Latest Inspection by provided date
    if (dateForInspection) {
      const [latestByDate] = sortedInspections.filter(keyInspection =>
        keyInspection.inspection.completionDate <= dateForInspection
      );

      if (latestByDate) {
        result.latestInspectionByDate = latestByDate.inspection;
        result.latestInspectionByDateKey = latestByDate.key;
      }
    }
  }

  return result;
}

function latestInspectionResponseData(date, propertyKey, latestInspection, latestInspectionKey) {
  const currentTimeSecs = date.getTime() / 1000;
  const currentDay = currentTimeSecs / 60 / 60 / 24;
  const creationDateDay = latestInspection.creationDate / 60 / 60 / 24; // days since Unix Epoch
  const completionDateDay = latestInspection.completionDate / 60 / 60 / 24; // days since Unix Epoch
  const score = Math.round(Number(latestInspection.score));
  const inspectionURL = `https://sparkle-production.herokuapp.com/properties/${propertyKey}/update-inspection/${latestInspectionKey}`;
  const inspectionOverdue = isInspectionOverdue(currentDay, creationDateDay, completionDateDay);

  let alert = '';
  let complianceAlert = '';

  if (inspectionOverdue) {
    alert = 'Blueshift Product Inspection OVERDUE (Last: ';
    alert += moment(latestInspection.creationDate * 1000).format('MM/DD/YY');
    alert += `, Completed: ${moment(latestInspection.completionDate * 1000).format('MM/DD/YY')}).`;

    // Append extra alert for past max duration warning
    if (completionDateDay - creationDateDay > 3) {
      alert += ' Over 3-day max duration, please start and complete inspection within 3 days.';
    }

    complianceAlert = alert;
  }

  // Less than 30 days ago, but Score less than 90%?
  if (score < 90) {
    if (alert) {
      alert += ' POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    } else {
      alert = 'POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!';
    }
  }

  return {
    creationDate: moment(latestInspection.creationDate * 1000).format('MM/DD/YY'),
    completionDate: moment(latestInspection.completionDate * 1000).format('MM/DD/YY'),
    score: `${score}%`,
    inspectionReportURL: latestInspection.inspectionReportURL,
    alert,
    complianceAlert,
    inspectionURL
  };
}

/**
 * Determine if inspection is "overdue"
 * @param  {Number} currentDay - Days since UNIX Epoch
 * @param  {Number} creationDateDay - Days since UNIX Epoch
 * @param  {Number} completionDateDay - Days since UNIX Epoch
 * @return {Boolean}
 */
function isInspectionOverdue(currentDay, creationDateDay, completionDateDay) {
  var differenceDays;

  if (currentDay - completionDateDay > 3) {
    // Formula when completed more than 3 days ago
    differenceDays = currentDay - (creationDateDay + 3); // days since creation + 3
  } else {
    // Formula when completed less than 3 days ago
    differenceDays = currentDay - completionDateDay; // days since completion
  }

  log.info(`Days since last inspection = ${differenceDays}`);
  return differenceDays > 7;
}
