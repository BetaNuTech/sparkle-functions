const assert = require('assert');
const log = require('../../utils/logger');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const validate = require('../utils/validate-update');
const getFullName = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'property: api: put';

/**
 * Factory for creating a PUT endpoint
 * that updates Firestore property
 * @param  {admin.firestore} fs
 * @return {Function} - Express middleware
 */
module.exports = function createPutProperty(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle PUT request for updating property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const { propertyId } = params;
    const update = body;
    const send500Error = create500ErrHandler(PREFIX, res);
    const hasUpdates = Boolean(Object.keys(update || {}).length);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Update property requested');

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} body missing update object`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Body missing update object',
            detail: 'Bad Request: property update body required',
          },
        ],
      });
    }

    // Validate property atrributes
    const propertyUpdateValidationErrors = validate(update);
    const isValidUpdate = propertyUpdateValidationErrors.length === 0;

    // Reject on invalid update attributes
    if (!isValidUpdate) {
      log.error(`${PREFIX} invalid update object`);
      return res.status(400).send({
        errors: propertyUpdateValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Lookup Firestore Property
    let property;
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

    // Update property
    try {
      await propertiesModel.firestoreUpdateRecord(fs, propertyId, update);
    } catch (err) {
      return send500Error(
        err,
        `failed to update property "${propertyId}"`,
        'failed to persist updates'
      );
    }

    // TODO handle `logo` images
    // TODO handle `banner` images
    // TODO handle `photo` images

    if (!incognitoMode) {
      try {
        // Notify of new inspection report
        await notificationsModel.firestoreAddRecord(fs, undefined, {
          name: property.name,
          summary: notifyTemplate('property-update-summary', {
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate('property-update-markdown-body', {
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
          property: property.id,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to update source notification | ${err}`); // proceed with error
      }
    }

    // Remove relationships
    // from attributes
    delete property.templates;

    // Send update property
    res.status(201).send({
      data: {
        id: propertyId,
        type: 'property',
        attributes: { ...property, ...update },
      },
    });
  };
};
