const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationsModel = require('../../models/integrations');

const PREFIX = 'clickup: api: delete-auth:';

/**
 * Remove ClickUp API credentials & integrations
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {functions.httpsFunction}
 */
module.exports = function createDeleteAuth(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Remove ClickUp API credentials & integrations
   * @param  {Object} req
   * @param  {Object} res
   * @return {Promise}
   */
  return async (req, res) => {
    const user = req.user || {};

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Set JSON API formatted response
    res.set('Content-Type', 'application/vnd.api+json');

    try {
      // Remove system ClickUp credentials
      await systemModel.removeClickUp(db);

      // Remove all property ClickUp integrations from system
      await systemModel.removeAllClickUpProperties(db);

      // Remove ClickUp integration details
      await integrationsModel.removeClickUp(db);

      log.info(`${PREFIX} successfully removed ClickUp integration`);

      return res.status(204).send();
    } catch (err) {
      log.error(`${PREFIX} ${err}`);

      return res.status(500).send({
        errors: [
          {
            title: 'Internal Server Error',
            detail: 'Failed to remove ClickUp integration',
          },
        ],
      });
    }
  };
};