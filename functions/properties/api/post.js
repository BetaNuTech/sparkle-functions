const assert = require('assert');
const propertiesModel = require('../../models/properties');
const validate = require('../utils/validate');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const { getFullName } = require('../../utils/user');
const log = require('../../utils/logger');

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
    const property = req.body;
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Create property requested');

    // Validate property atrributes
    const propertyValidationErrors = validate(property);
    const isValidProperty = propertyValidationErrors.length === 0;

    // Reject on missing property attributes
    if (!isValidProperty) {
      return res.status(400).send({
        errors: propertyValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Generate property ID
    const propertyId = propertiesModel.createId(fs);

    // Create new property record
    try {
      await propertiesModel.createRecord(fs, propertyId, property);
    } catch (err) {
      return send500Error(err, 'property creation failed', 'unexpected error');
    }

    if (!incognitoMode) {
      try {
        // Notify of new inspection report
        await notificationsModel.addRecord(fs, {
          title: 'Property Creation',
          summary: notifyTemplate('property-creation-summary', {
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate('property-creation-markdown-body', {
            name: property.name,
            addr1: property.addr1,
            addr2: property.addr2,
            city: property.city,
            state: property.state,
            zip: property.zip,
            teamName: property.teamName,
            code: property.code,
            slackChannel: property.slackChannel,
            templateNames: property.templates,
            bannerPhotoURL: property.bannerPhotoURL,
            photoURL: property.photoURL,
          }),
          creator: req.user ? req.user.id || '' : '',
          property: propertyId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification | ${err}`); // proceed with error
      }
    }

    // Send newly created property
    res.status(201).send({
      data: {
        id: propertyId,
        type: 'property',
        attributes: property,
      },
    });
  };
};
