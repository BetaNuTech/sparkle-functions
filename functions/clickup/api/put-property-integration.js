const assert = require('assert');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'clickup: api: put-property-integration:';
const VALID_PAYLOAD_ATTRS = [
  'spaceId',
  'spaceName',
  'deficienciesListId',
  'deficienciesListName',
  'deficienciesFolderId',
  'deficienciesFolderName',
  'jobsListId',
  'jobsListName',
  'jobsFolderId',
  'jobsFolderName',
];

/**
 * Factory for property ClickUp integration
 * creation and updating
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPutPropertyClickUpIntegration(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PUT request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body } = req;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);
    const hasUpdates = Boolean(Object.keys(body || {}).length);
    const { propertyId } = params;

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set JSON API formatted response
    res.set('Content-Type', 'application/vnd.api+json');

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} missing updates in payload`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'body missing update object',
            detail: 'Bad Request: update body required',
          },
        ],
      });
    }

    // Request payload validations
    const invalidAttrUpdates = Object.keys(body).filter(
      attr => !VALID_PAYLOAD_ATTRS.includes(attr)
    );
    const invalidValueUpdates = Object.keys(body).filter(
      attr =>
        VALID_PAYLOAD_ATTRS.includes(attr) && typeof body[attr] !== 'string'
    );
    const hasInvalidPayload =
      invalidAttrUpdates.length + invalidValueUpdates.length > 0;

    if (hasInvalidPayload) {
      log.error(`${PREFIX} invalid update attributes or values`);
      const attrErrors = invalidAttrUpdates.map(attr => ({
        detail: `invalid payload attribute: "${attr}"`,
        source: { pointer: attr },
      }));
      const valueErrors = invalidValueUpdates.map(attr => ({
        detail: `invalid payload value at: "${attr}" must be a string`,
        source: { pointer: attr },
      }));
      return res.status(400).send({
        errors: [...attrErrors, ...valueErrors],
      });
    }

    // Validate required fields - must have space and at least one list
    if (!body.spaceId || !body.spaceName) {
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'spaceId/spaceName' },
            title: 'Missing required fields',
            detail: 'Both spaceId and spaceName are required',
          },
        ],
      });
    }

    const hasDeficienciesList =
      body.deficienciesListId && body.deficienciesListName;
    const hasJobsList = body.jobsListId && body.jobsListName;

    if (!hasDeficienciesList && !hasJobsList) {
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'lists' },
            title: 'Missing list configuration',
            detail:
              'At least one list (deficiencies or jobs) must be configured',
          },
        ],
      });
    }

    // Lookup Property
    let property = null;
    try {
      const snapshot = await propertiesModel.findRecord(db, propertyId);
      property = snapshot.data() || null;
    } catch (err) {
      return send500Error(err, 'property lookup failed', 'unexpected error');
    }

    // Non-existent property
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

    // Lookup any existing ClickUp property integration
    let previousClickUpIntegration = {};
    try {
      const snapshot = await integrationsModel.findClickUpProperty(
        db,
        propertyId
      );
      previousClickUpIntegration = snapshot.data() || {};
    } catch (err) {
      log.error(`${PREFIX} property ClickUp integration lookup failed: ${err}`);
      // allow failure
    }

    const now = Math.round(Date.now() / 1000);
    const payload = { ...body, updatedAt: now };
    if (!previousClickUpIntegration.createdAt) {
      payload.createdAt = now;
    }

    // Persist updates
    try {
      await integrationsModel.setClickUpPropertyRecord(
        db,
        propertyId,
        payload,
        null,
        true
      );
    } catch (err) {
      return send500Error(
        err,
        'property ClickUp integration write failed',
        'unexpected error'
      );
    }

    res.status(201).send({
      data: {
        id: `clickup-${propertyId}`,
        type: 'integration',
        attributes: { ...previousClickUpIntegration, ...payload },
      },
    });

    if (!incognitoMode) {
      // Prepare notification data
      const previousSpace = previousClickUpIntegration.spaceName || 'NOT SET';
      const previousDeficienciesList =
        previousClickUpIntegration.deficienciesListName || 'NOT SET';
      const previousJobsList =
        previousClickUpIntegration.jobsListName || 'NOT SET';
      const currentSpace = body.spaceName || 'NOT SET';
      const currentDeficienciesList = body.deficienciesListName || 'NOT SET';
      const currentJobsList = body.jobsListName || 'NOT SET';

      try {
        // Notify of updated property ClickUp integration
        await notificationsModel.addRecord(db, {
          title: 'ClickUp Settings Change for Property',
          summary: notifyTemplate(
            'property-clickup-integration-update-summary',
            {
              propertyName: property.name,
              authorName,
            }
          ),
          markdownBody: notifyTemplate(
            'property-clickup-integration-update-markdown-body',
            {
              propertyName: property.name,
              previousSpace,
              previousDeficienciesList,
              previousJobsList,
              currentSpace,
              currentDeficienciesList,
              currentJobsList,
              authorName,
              authorEmail,
            }
          ),
          creator: authorId,
          property: propertyId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }
  };
};
