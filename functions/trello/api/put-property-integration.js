const assert = require('assert');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'trello: api: put-property-integration:';
const VALID_PAYLOAD_ATTRS = [
  'closedBoard',
  'closedBoardName',
  'closedList',
  'closedListName',
  'openBoard',
  'openBoardName',
  'openList',
  'openListName',
];

/**
 * Factory for property trello integration
 * creation and updating
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPutPropertyTrelloIntegration(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PUT requst
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

    // Lookup any existing trello property
    let previousTrelloIntegration = {};
    try {
      const snapshot = await integrationsModel.findTrelloProperty(
        db,
        propertyId
      );
      previousTrelloIntegration = snapshot.data() || {};
    } catch (err) {
      log.error(`${PREFIX} property trello integration lookup failed: ${err}`);
      // allow failure
    }

    const now = Math.round(Date.now() / 1000);
    const payload = { ...body, updatedAt: now };
    if (!previousTrelloIntegration) {
      payload.createdAt = now;
    }

    // Persist updates
    try {
      await integrationsModel.setTrelloPropertyRecord(
        db,
        propertyId,
        payload,
        null,
        true
      );
    } catch (err) {
      return send500Error(
        err,
        'property trello integration write failed',
        'unexpected error'
      );
    }

    res.status(201).send({
      id: `trello-${propertyId}`,
      type: 'integration',
      attributes: { ...previousTrelloIntegration, ...payload },
    });

    if (!incognitoMode) {
      const previousOpenBoard =
        previousTrelloIntegration.openBoardName || 'NOT SET';
      const previousOpenList =
        previousTrelloIntegration.openListName || 'NOT SET';
      const previousClosedBoard =
        previousTrelloIntegration.closedBoardName || 'NOT SET';
      const previousClosedList =
        previousTrelloIntegration.closedListName || 'NOT SET';
      const currentOpenBoard = body.openBoardName || 'NOT SET';
      const currentOpenList = body.openListName || 'NOT SET';
      const currentClosedBoard = body.closedBoardName || 'NOT SET';
      const currentClosedList = body.closedListName || 'NOT SET';

      try {
        // Notify of updated property trello integration
        await notificationsModel.addRecord(db, {
          title: 'Trello Settings Change for Property',
          summary: notifyTemplate(
            'property-trello-integration-update-summary',
            {
              authorName,
            }
          ),
          markdownBody: notifyTemplate(
            'property-trello-integration-update-markdown-body',
            {
              previousOpenBoard,
              previousOpenList,
              previousClosedBoard,
              previousClosedList,
              currentOpenBoard,
              currentOpenList,
              currentClosedBoard,
              currentClosedList,
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
