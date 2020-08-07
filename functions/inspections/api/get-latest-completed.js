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
    if (propertyCode) {
      try {
        const snap = await propertiesModel.firestoreQuery(fs, {
          code: ['==', `${propertyCode}`],
        });
        if (snap.size === 0) {
          throw Error('property does not exist');
        }
        inspQuery.property = ['==', snap.docs[0].id];
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
      inspection = { ...inspDoc.data(), id: inspDoc.id };
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

    // Successful response
    res.status(200).send({ data: createJsonApiInspection(inspection) });
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
