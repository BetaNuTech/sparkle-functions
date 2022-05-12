const assert = require('assert');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'trello: api: delete-property-integration:';

/**
 * Factory for property trello integration deletion
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeletePropertyTrelloIntegration(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle DELETE requst
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params } = req;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);
    const { propertyId } = params;

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

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

      return res
        .status(404)
        .set('Content-Type', 'application/vnd.api+json')
        .send({
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

    // Persist updates
    try {
      await integrationsModel.removeTrelloProperty(db, propertyId);
    } catch (err) {
      return send500Error(
        err,
        'property trello integration removal failed',
        'unexpected error'
      );
    }

    res.status(204).send();

    if (!incognitoMode) {
      const previousOpenBoard =
        previousTrelloIntegration.openBoardName || 'NOT SET';
      const previousOpenList =
        previousTrelloIntegration.openListName || 'NOT SET';
      const previousClosedBoard =
        previousTrelloIntegration.closedBoardName || 'NOT SET';
      const previousClosedList =
        previousTrelloIntegration.closedListName || 'NOT SET';

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
              currentOpenBoard: 'NOT SET',
              currentOpenList: 'NOT SET',
              currentClosedBoard: 'NOT SET',
              currentClosedList: 'NOT SET',
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
