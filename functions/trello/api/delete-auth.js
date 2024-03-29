const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationsModel = require('../../models/integrations');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'trello: api: delete-auth:';

/**
 * Factory for deleting Trello authorizor
 * for the organization and property configs
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteTrelloAuthHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user } = req;
    const send500Error = create500ErrHandler(PREFIX, res);
    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    const batch = db.batch();

    // Destroy system's private auth token
    try {
      await systemModel.removeTrello(db, batch);
    } catch (err) {
      return send500Error(
        err,
        `failed to destroy trello credentials | ${err}`,
        'System Error'
      );
    }

    try {
      await systemModel.removeAllTrelloProperties(db, batch);
    } catch (err) {
      return send500Error(
        err,
        `failed to destroy system trello properties | ${err}`,
        'System Properties Error'
      );
    }

    // Delete public facing Trello orgnaization
    try {
      await integrationsModel.removeTrello(db, batch);
    } catch (err) {
      return send500Error(
        err,
        `failed to destroy trello integration | ${err}`,
        'Integration Organization Error'
      );
    }

    // Delete public facing Trello properties
    try {
      await integrationsModel.removeAllTrelloProperties(db, batch);
    } catch (err) {
      return send500Error(
        err,
        `failed to destroy trello integration details | ${err}`,
        'Integration Error'
      );
    }

    // Commit all updates
    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        `failed to commit database writes | ${err}`,
        'System Error'
      );
    }

    log.info(`${PREFIX} Trello deleted by user: "${user.id}"`);
    res.status(204).send();
  };
};
