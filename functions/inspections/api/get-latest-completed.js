const assert = require('assert');
const log = require('../../utils/logger');
const config = require('../../config');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');

const PREFIX = 'inspections: api: get-latest-completed:';
const INSP_PATH = config.clientApps.web.inspectionURL;

/**
 * Factory for getting the latest completed
 * inspection according to provided parameters
 * @param  {admin.firestore} fs
 * @return {Function} - Express handler
 */
module.exports = function createGetLatestCompleted(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Lookup the latest completed inspection
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { before, propertyCode, templateName } = req.query;
    const now = Math.round(Date.now() / 1000);
    let beforeQuery = now;
    const inspQuery = {};

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    if (before) {
      const beforeParsed = parseInt(before, 10);

      if (
        before.match(/^\d+$/) && // query is numeric characters
        typeof beforeParsed === 'number' &&
        beforeParsed === beforeParsed &&
        beforeParsed < now
      ) {
        beforeQuery = beforeParsed;
      } else {
        return res.status(400).send({
          errors: [
            { detail: 'Bad Request: "before" must be a valid past UNIX time.' },
          ],
        });
      }
    }

    // Lookup property ID with code
    // when propertyCode provided
    let property = null;
    if (propertyCode) {
      try {
        const snap = await propertiesModel.firestoreQuery(fs, {
          code: ['==', `${propertyCode}`],
        });
        if (snap.size === 0) {
          throw Error('property does not exist');
        }
        const [doc] = snap.docs;
        inspQuery.property = ['==', doc.id];
        property = { id: doc.id, ...doc.data() };
      } catch (err) {
        log.error(
          `${PREFIX} property lookup failed for code: "${propertyCode}" | ${err}`
        );
        if (`${err}`.search('property does not exist') > -1) {
          return res.status(400).send({
            errors: [
              { detail: `property with code: "${propertyCode}" not found` },
            ],
          });
        }
        return res
          .status(500)
          .send({ errors: [{ detail: 'property lookup failed' }] });
      }
    }

    // Add optional template
    // name to inspection query
    if (templateName) {
      inspQuery.templateName = ['==', `${templateName}`];
    }

    // Lookup properties completed inspections
    let inspection = null;
    try {
      const snap = await inspectionsModel.firestoreLatestCompletedQuery(
        fs,
        beforeQuery,
        inspQuery
      );
      if (snap.size === 0) {
        throw Error('no completed inspections found');
      }
      const [inspDoc] = snap.docs;
      inspection = { id: inspDoc.id, ...inspDoc.data() };
    } catch (err) {
      log.error(`${PREFIX} inspections lookup failed | ${err}`);
      if (`${err}`.search('no completed inspections') > -1) {
        return res
          .status(404)
          .send({ errors: [{ detail: 'no inspection found for query' }] });
      }
      return res
        .status(500)
        .send({ errors: [{ detail: 'inspections lookup failed' }] });
    }

    // Lookup inspection property
    // when not previously discovered
    if (!property) {
      try {
        const propertySnap = await propertiesModel.firestoreFindRecord(
          fs,
          inspection.property
        );
        property = { id: propertySnap.id, ...propertySnap.data() };
      } catch (err) {
        // Allow failure
        log.error(
          `${PREFIX} property lookup failed for: "${inspection.property}" | ${err}`
        );
      }
    }

    // Successful response
    res.status(200).send({
      included: property ? [createJsonApiProperty(property)] : [],
      data: createJsonApiInspection(inspection),
    });
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
 * Create a JSON API inspection document
 * @param  {Object} data
 * @return {Object}
 */
function createJsonApiInspection(data) {
  assert(data && typeof data === 'object', 'has inspection data');
  assert(data.id && typeof data.id === 'string', 'has inspection id');
  assert(
    data.property && typeof data.property === 'string',
    'has data property association'
  );

  return {
    id: data.id,
    type: 'inspection',
    attributes: {
      creationDate: data.creationDate || 0,
      completionDate: data.completionDate || 0,
      score: `${data.score || 0}%`,
      templateName: data.templateName || '',
      inspectionReportURL: data.inspectionReportURL || '',
      inspectionURL: createInspectionUrl(data.property, data.id),
    },
  };
}

/**
 * Create a JSON API property document
 * @param  {Object} data
 * @return {Object}
 */
function createJsonApiProperty(data) {
  assert(data && typeof data === 'object', 'has property data');
  assert(data.id && typeof data.id === 'string', 'has property id');

  return {
    id: data.id,
    type: 'property',
    attributes: {
      name: data.name || '',
      code: data.code || '',
      lastInspectionDate: data.lastInspectionDate || 0,
      lastInspectionScore: data.lastInspectionScore || 0,
      numOfInspections: data.numOfInspections || 0,
      numOfDeficientItems: data.numOfDeficientItems || 0,
      numOfFollowUpActionsForDeficientItems:
        data.numOfFollowUpActionsForDeficientItems || 0,
    },
  };
}
