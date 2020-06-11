const assert = require('assert');
const moment = require('moment-timezone');
const log = require('../../utils/logger');
const config = require('../../config');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const isInspectionOverdue = require('../../inspections/api/utils/is-inspection-overdue');
const zipToTimezone = require('../../utils/zip-to-timezone');

const PREFIX = 'properies: api: get-latest-completed-inspection:';
const INSP_PATH = config.clientApps.web.inspectionURL;
const TEMP_NAME_LOOKUP = config.inspections.blueshiftTemplateName;

/**
 * Factory for getting the latest completed inspection
 * @param  {admin.firestore} fs
 * @return {Function} - Express handler
 */
module.exports = function createGetLatestCompletedInspection(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Lookup the latest completed inspection for a property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const payload = { data: null };
    const { params } = req;
    const propertyCode = params;
    const otherDate = parseInt(req.query.other_date || '0', 10);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    if (
      (otherDate && typeof otherDate !== 'number') ||
      (otherDate && otherDate !== otherDate) ||
      (otherDate && otherDate < 500000000)
    ) {
      return res.status(400).send({
        errors: [
          { detail: 'Bad Request: "other_date" must be a valid UNIX time.' },
        ],
      });
    }

    // Lookup property by code
    let property = null;
    try {
      const snap = await propertiesModel.firestoreQuery(fs, {
        code: ['==', propertyCode],
      });
      if (!snap.exists || snap.size === 0) {
        throw Error('property does not exist');
      }
      property = snap.docs[0].data();
      property.id = snap.docs[0].id;
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
      if (`${err}`.search('property does not exist') > -1) {
        return res
          .status(404)
          .send({ errors: [{ detail: 'code lookup, not found.' }] });
      }
      return res
        .status(500)
        .send({ errors: [{ detail: 'property lookup failed' }] });
    }

    // Lookup properties completed inspections
    const inspections = [];
    try {
      const snap = await inspectionsModel.firestoreQuery(fs, {
        property: ['==', property.id],
        inspectionCompleted: ['==', true],
        completionDate: ['>', 0],
        templateName: ['==', TEMP_NAME_LOOKUP],
      });
      if (!snap.exists || snap.size === 0) {
        throw Error('no completed inspections');
      }
      snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Sort by creation date descending
        .sort((a, b) => b.creationDate - a.creationDate)
        .forEach(result => inspections.push(result));
    } catch (err) {
      log.error(`${PREFIX} inspections lookup failed | ${err}`);
      if (`${err}`.search('no completed inspections') > -1) {
        return res
          .status(404)
          .send({ errors: [{ detail: 'no inspections exist yet.' }] });
      }
      return res
        .status(500)
        .send({ errors: [{ detail: 'inspections lookup failed' }] });
    }

    // Set latest inspection
    const [latest] = inspections;
    payload.data = createJsonApiInspection(latest);

    // TODO: setup latest inspection by other date

    // Set latest inspection alerts
    const alerts = createInspectionAlerts(property, latest);

    if (alerts.alert || alerts.complianceAlert) {
      payload.meta = payload.meta || {};
      if (alerts.alert) payload.meta.alert = alerts.alert;
      if (alerts.complianceAlert)
        payload.meta.complianceAlert = alerts.complianceAlert;
    }

    // Append latest inspection by other date alerts
    if (otherDate) {
      const [latestByDate] = inspections.filter(
        ({ creationDate }) => creationDate <= otherDate
      );
      if (latestByDate) {
        payload.included = [createJsonApiInspection(latestByDate)];
        const { alert, complianceAlert } = createInspectionAlerts(
          property,
          latestByDate,
          otherDate
        );

        // Append latest by date alerts
        if (alert || complianceAlert) payload.meta = payload.meta || {};
        if (alert) payload.meta.alertIncluded = alert;
        if (complianceAlert)
          payload.meta.complianceAlertIncluded = complianceAlert;
      }
    }

    res.status(200).send(payload);
  };
};

/**
 * Create a url to the web client's inspection
 * @param  {String} propertyId
 * @param  {String} inspectionId
 * @return {String}
 */
function createInspectionUrl(propertyId, inspectionId) {
  assert(propertyId && typeof propertyId === 'string', 'has property id');
  assert(inspectionId && typeof inspectionId === 'string', 'has inspection id');
  return INSP_PATH.replace('{{propertyId}}', propertyId).replace(
    '{{inspectionId}}',
    inspectionId
  );
}

/**
 * Format a timestamp with an optional zip code
 * @param  {Number} unixTimestamp
 * @param  {String?} zip - property's zip code
 * @return {String} - MM/DD/YY formatted date
 */
function formattedDate(unixTimestamp, zip) {
  assert(
    unixTimestamp && typeof unixTimestamp === 'number',
    'has UNIX timestap'
  );
  const momentSnap = moment(unixTimestamp * 1000);

  if (zip) {
    const timezone = zipToTimezone(`${zip}`);
    return momentSnap.tz(timezone).format('MM/DD/YY');
  }
  return momentSnap.format('MM/DD/YY');
}

/**
 * Create a JSON API inspection document
 * @param  {Object} data
 * @return {Object}
 */
function createJsonApiInspection(data) {
  assert(data && typeof data === 'object', 'has inspection data');

  return {
    id: data.id,
    type: 'inspection',
    attributes: {
      creationDate: data.creationDate,
      completionDate: data.completionDate,
      score: `${data.score}%`,
      inspectionReportURL: data.inspectionReportURL,
      inspectionURL: createInspectionUrl(data.property, data.id),
    },
  };
}

/**
 * Create any alert and/or compliance
 * alert for an inspection
 * @param  {Object} property
 * @param  {Object} inspection
 * @param  {Number?} compareDate - optional UNIX timestamp for comparison
 * @return {Object}
 */
function createInspectionAlerts(
  property,
  inspection,
  compareDate = Math.round(Date.now() / 1000)
) {
  assert(property && typeof property === 'object', 'has property data');
  assert(inspection && typeof inspection === 'object', 'has inspection data');
  assert(
    compareDate && typeof compareDate === 'number',
    'has comparison timestamp'
  );

  const result = {};
  const daysSinceEpoche = compareDate / 60 / 60 / 24;
  const daysSinceCreation = inspection.creationDate / 60 / 60 / 24; // days since Unix Epoch
  const daysSinceCompletion = inspection.completionDate / 60 / 60 / 24; // days since Unix Epoch

  if (isInspectionOverdue(daysSinceEpoche, daysSinceCreation)) {
    let alert = `Blueshift Product Inspection OVERDUE (Last: ${formattedDate(
      inspection.creationDate,
      property.zip
    )}, Completed: ${formattedDate(inspection.completionDate, property.zip)}).`;

    // Append extra alert for taking over 3 days
    // to complete the latest inspection
    if (daysSinceCompletion - daysSinceCreation > 3) {
      alert +=
        ' Over 3-day max duration, please start and complete inspection within 3 days.';
    }

    // Set latest inspection alerts
    result.alert = alert;
    result.complianceAlert = alert;
  }

  if (inspection.score < 90) {
    let scoreAlert = result.alert || '';
    scoreAlert += `${
      scoreAlert ? ' ' : ''
    }POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!`;

    // Set/update latest inspection alert
    result.alert = scoreAlert;
  }

  return result;
}
