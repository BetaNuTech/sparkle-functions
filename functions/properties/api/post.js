const assert = require('assert');
const propertiesModel = require('../../models/properties');
const validateProperty = require('../utils/validate');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'property: api: post:';

/**
 * Factory for creating a POST endpoint
 * that creates Firestore inspection
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPost(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    const property = {
      name: 'Not Set',
      templates: {},
    };

    const hasProperty = Boolean(Object.keys(property || {}).length);
    const isValidProperty = hasProperty
      ? validateProperty(property).length === 0
      : false;

    // Reject on missing property attributes
    if (!isValidProperty) {
      return send500Error(
        'Bad Request: Property is not valid, please provide acceptable payload'
      );
    }

    // TODO send property create global notification
    try {
      await propertiesModel.firestoreCreateRecord(fs, undefined, property);
    } catch (err) {
      return send500Error(err, 'property creation failed', 'unexpected error');
    }

    // Send newly created property
    res.status(201).send({
      data: {
        type: 'property',
        attributes: property,
      },
    });
  };
};
