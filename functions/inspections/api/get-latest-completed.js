const assert = require('assert');
const express = require('express');
const cors = require('cors');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const log = require('../../utils/logger');
const zipToTimezone = require('../../utils/zip-to-timezone');
const latestInspectionResponseData = require('./utils/latest-response-json');
const config = require('../../config/inspections');

const PREFIX = 'inspections: api: get-latest-completed:';
const TEMP_NAME_LOOKUP = config.blueshiftTemplateName;

/**
 * Factory for getting the latest completed inspection
 * TODO: Delete when Firestore fully supported
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetLatestCompletedInspection(db) {
  assert(db && typeof db.ref === 'function', 'has realtime db');

  /**
   * Lookup the latest completed inspection for a property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const getlatestCompletedInspectionHandler = async (req, res) => {
    const propertyCode = req.query.cobalt_code;
    const otherDate = req.query.other_date;
    const dateForInspection = otherDate
      ? Math.round(new Date(otherDate).getTime() / 1000)
      : 0;

    if (!propertyCode) {
      return res.status(400).send('Bad Request. Missing Parameters.');
    }

    let propertySnap;
    try {
      propertySnap = await propertiesModel.realtimeQueryByCode(
        db,
        propertyCode
      );
    } catch (err) {
      log.error(`${PREFIX} property code query failed | ${err}`);
      return res.status(500).send('Unable to retrieve data');
    }

    if (!propertySnap.exists()) {
      return res.status(404).send('code lookup, not found.');
    }

    // Get first and only property id from results
    const [propertyId] = Object.keys(propertySnap.val());

    let inspectionsSnapshot;
    try {
      inspectionsSnapshot = await inspectionsModel.queryByProperty(
        db,
        propertyId
      );
    } catch (err) {
      // Handle any errors
      log.error(`${PREFIX} inspections query by property failed | ${err}`);
      res.status(500).send('No inspections found.');
    }

    if (!inspectionsSnapshot.exists()) {
      return res.status(404).send('no inspections exist yet.');
    }

    const {
      latestInspection,
      latestInspectionId,
      latestInspectionByDate,
      latestInspectionByDateId,
    } = findLatestData(inspectionsSnapshot, dateForInspection);

    if (!latestInspection) {
      return res.status(404).send('No completed latest inspection found.');
    }

    // Successful response
    const property = propertySnap.val()[propertyId];
    const propertyTimezone = zipToTimezone(property.zip);
    const responseData = latestInspectionResponseData(
      new Date(),
      propertyId,
      latestInspection,
      latestInspectionId,
      propertyTimezone
    );
    if (latestInspectionByDate) {
      responseData.latest_inspection_by_date = latestInspectionResponseData(
        new Date(otherDate),
        propertyId,
        latestInspectionByDate,
        latestInspectionByDateId,
        propertyTimezone
      );
    }

    res.status(200).send(responseData);
  };

  // Create express app with single endpoint
  // that configures a required url param
  const app = express();
  app.use(cors());
  app.get('/', getlatestCompletedInspectionHandler);
  return app;
};

/**
 * Find latest inspection from inspections snapshot
 * - provide any available meta data about the latest inspection
 * @param  {firebase.DataSnapshot} inspectionsSnapshot
 * @param  {Number?} dateForInspection
 * @return {Object}
 */
function findLatestData(inspectionsSnapshot, dateForInspection) {
  const result = {
    latestInspection: null,
    latestInspectionId: null,
    latestInspectionByDate: null,
    latestInspectionByDateId: null,
  };
  const inspections = [];

  // Top level, single, inspection
  // TODO: remove inspections snapshot always has children
  if (!inspectionsSnapshot.hasChildren()) {
    const inspection = inspectionsSnapshot.val();

    if (
      inspection.inspectionCompleted &&
      inspection.completionDate &&
      inspection.template.name.indexOf(TEMP_NAME_LOOKUP) > -1
    ) {
      result.latestInspection = inspection;
      result.latestInspectionId = inspectionsSnapshot.key;
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
      (insp.templateName || insp.template.name || '').indexOf(
        TEMP_NAME_LOOKUP
      ) > -1
    ) {
      inspections.push({ inspection: insp, key });
    }
  });

  if (inspections.length > 0) {
    const sortedInspections = inspections.sort(
      (a, b) => b.inspection.creationDate - a.inspection.creationDate
    ); // DESC
    result.latestInspection = sortedInspections[0].inspection;
    result.latestInspectionId = sortedInspections[0].key;

    // Latest Inspection by provided date
    if (dateForInspection) {
      const [latestByDate] = sortedInspections.filter(
        keyInspection =>
          keyInspection.inspection.creationDate <= dateForInspection
      );

      if (latestByDate) {
        result.latestInspectionByDate = latestByDate.inspection;
        result.latestInspectionByDateId = latestByDate.key;
      }
    }
  }

  return result;
}
