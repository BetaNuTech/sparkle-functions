const assert = require('assert');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'clickup: api: delete-property-integration:';

/**
 * Factory for deleting property ClickUp integration
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeletePropertyClickUpIntegration(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle DELETE request
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

    // Set JSON API formatted response
    res.set('Content-Type', 'application/vnd.api+json');

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
    let existingClickUpIntegration = null;
    try {
      const snapshot = await integrationsModel.findClickUpProperty(
        db,
        propertyId
      );
      existingClickUpIntegration = snapshot.data() || null;
    } catch (err) {
      log.error(`${PREFIX} property ClickUp integration lookup failed: ${err}`);
      // allow failure
    }

    // No integration to delete
    if (!existingClickUpIntegration) {
      log.error(
        `${PREFIX} property: "${propertyId}" has no ClickUp integration`
      );
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'integration' },
            title: 'ClickUp integration not found',
            detail: 'Property has no ClickUp integration to delete',
          },
        ],
      });
    }

    // Delete the integration
    try {
      await integrationsModel.removeClickUpProperty(db, propertyId);
    } catch (err) {
      return send500Error(
        err,
        'property ClickUp integration deletion failed',
        'unexpected error'
      );
    }

    // Also clean up any ClickUp task references in system model
    try {
      // Remove all task references for this property
      const systemDoc = db.collection('system').doc(`clickup-${propertyId}`);
      await systemDoc.delete();
    } catch (err) {
      log.error(
        `${PREFIX} failed to clean up system ClickUp references: ${err}`
      );
      // Allow failure - not critical
    }

    res.status(204).send(); // No content response for successful deletion

    if (!incognitoMode) {
      try {
        // Notify of deleted property ClickUp integration
        await notificationsModel.addRecord(db, {
          title: 'ClickUp Integration Removed for Property',
          summary: notifyTemplate(
            'property-clickup-integration-removal-summary',
            {
              propertyName: property.name,
              authorName,
            }
          ),
          markdownBody: notifyTemplate(
            'property-clickup-integration-removal-markdown-body',
            {
              propertyName: property.name,
              spaceName: existingClickUpIntegration.spaceName || 'Unknown',
              deficienciesListName:
                existingClickUpIntegration.deficienciesListName ||
                'Not configured',
              jobsListName:
                existingClickUpIntegration.jobsListName || 'Not configured',
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
