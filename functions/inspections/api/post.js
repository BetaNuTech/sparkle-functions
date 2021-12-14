const assert = require('assert');
const log = require('../../utils/logger');
const propertiesModel = require('../../models/properties');
const templatesModel = require('../../models/templates');
const inspectionsModel = require('../../models/inspections');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const setItemDefaults = require('../utils/set-item-defaults');
const { getFullName } = require('../../utils/user');

const PREFIX = 'inspection: api: post:';

/**
 * Factory for creating a POST endpoint
 * that creates Firestore inspection
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function post(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const { propertyId } = req.params;
    const { template: templateId } = body;
    const user = req.user;
    const send500Error = create500ErrHandler(PREFIX, res);
    const badReqPayload = { errors: [] };

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Create inspection requested');

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
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
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
      const templateSnap = await templatesModel.findRecord(db, templateId);
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

    let inspectionId = '';
    let inspection = null;
    try {
      // Assemble inspection
      inspectionId = inspectionsModel.createId(db);
      inspection = {
        templateId,
        property: propertyId,
        template: JSON.parse(JSON.stringify(template)),
        inspectorName: getFullName(user),
        inspector: user.id,
        totalItems: Object.keys(template.items || {}).length || 1,
        templateName: template.name,
        itemsCompleted: 0,
        inspectionCompleted: false,
        completionDate: 0,
        deficienciesExist: false,
        score: 0,
        createdAt: Math.floor(Date.now() / 1000),
        creationDate: Math.floor(Date.now() / 1000),
        updatedLastDate: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
        templateCategory: template.category || '',
      };

      // Add item defaults
      Object.keys(inspection.template.items || {}).forEach(itemId => {
        const item = inspection.template.items[itemId];
        Object.assign(item, setItemDefaults(item)); // merge defaults into item
      });

      // Write inspection
      await inspectionsModel.createRecord(db, inspectionId, inspection);
    } catch (err) {
      return send500Error(err, 'inspection write failed', 'unexpected error');
    }

    res.status(201).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: inspection,
      },
    });
  };
};
