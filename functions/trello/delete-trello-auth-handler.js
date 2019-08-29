const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');
const integrationsModel = require('../models/integrations');

const PREFIX = 'trello: delete authorization:';

/**
 * Factory for deleting Trello authorizor
 * for the organization and property configs
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createDeleteTrelloAuthHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * Handle deletion
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { user } = req;

    log.info(`${PREFIX} requested by user: ${user.id}`);

    // Destroy system's private auth token
    try {
      await systemModel.destroyTrelloCredentials(db);
    } catch (err) {
      log.error(`${PREFIX} destroy trello credentials failed | ${err}`);
      return res.status(500).send({ message: 'system failure' });
    }

    // Delete public facing Trello orgnaization
    try {
      await integrationsModel.destroyTrelloOrganization(db);
    } catch (err) {
      log.error(`${PREFIX} destroy trello organization failed | ${err}`);
      return res.status(500).send({ message: 'system failure' });
    }

    // Move all properties Trello configurations to /archive
    try {
      const result = await integrationsModel.archiveAllPropertyTrelloConfigs(
        db
      );
      if (result) log.info(`${PREFIX} archived trello property integrations`);
    } catch (err) {
      log.error(
        `${PREFIX} archiving trello property integrations failed | ${err}`
      );
      return res.status(500).send({ message: 'system failure' });
    }

    res.status(200).send({ message: 'successful' });
  };

  // Create express app with single DELETE endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.delete(
    '/integrations/trello/authorization',
    authUser(db, auth, true),
    handler
  );

  return app;
};
