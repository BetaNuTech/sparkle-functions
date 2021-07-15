const assert = require('assert');
const log = require('../../utils/logger');
const propertiesModel = require('../../models/properties');
const templatesModel = require('../../models/templates');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const getFullName = require('../../utils/user');

const PREFIX = 'inspection: api: post:';

/**
 * Factory for creating a POST endpoint
 * that creates Firestore inspection
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */

module.exports = function post(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const { property: propertyId } = body;
    const { template: templateId } = body;
    const user = req.user;
    const send500Error = create500ErrHandler(PREFIX, res);
    const badReqPayload = { errors: [] };

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Create inspection requested');

    // Missing property attribute
    if (!propertyId) {
      badReqPayload.errors.push({
        source: { pointer: 'property' },
        title: 'body missing "property" identifier',
        detail: 'property is required',
      });
    }

    // Missing template attribute
    if (!templateId) {
      badReqPayload.errors.push({
        source: { pointer: 'template' },
        title: 'body missing "template" identifier',
        detail: 'template is required',
      });
    }

    // Send bad request error
    if (badReqPayload.errors.length) {
      log.error(`${PREFIX} invalid user request`);
      return res.status(400).send(badReqPayload);
    }

    // Lookup Firestore Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      property = propertySnap.data() || null;
    } catch (err) {
      return send500Error(err, 'property lookup failed', 'unexpected error');
    }

    // Invalid property
    if (!property) {
      log.error(`${PREFIX} requested property: "${propertyId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'property' },
            title: 'Property not found',
          },
        ],
      });
    }

    // Lookup Firestore Template
    let template = null;
    try {
      const templateSnap = await templatesModel.firestoreFindRecord(
        fs,
        templateId
      );
      template = templateSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'template lookup failed', 'unexpected error');
    }

    if (!template) {
      log.error(`${PREFIX} requested template: "${templateId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'template' },
            title: 'Template not found',
          },
        ],
      });
    }

    // generate and send inspection
    let inspection = null;
    try {
      inspection = {
        property: property.id,
        template: JSON.parse(JSON.stringify(template)),
        templateId: template.id,
        inspectorName: getFullName(user),
        inspector: user.id,
      };
    } catch (err) {
      return send500Error(err, 'json parsing error', 'unexpected error');
    }

    res.status(201).send({
      data: {
        inspection,
      },
    });
  };
};
