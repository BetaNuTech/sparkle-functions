const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');

const PREFIX = 'trello: upsert token:';

/**
 * Factory for trello token upsert endpoint
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnUpsertTrelloTokenHandler(db, auth) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Write /trelloTokens to integration/trello
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const createTrelloTokenHandler = async (req, res) => {
    const { user, body, params } = req;
    const { apikey, authToken } = body;
    const { propertyId } = params;

    if (!propertyId) {
      const message = 'request missing propertyId parameter';
      return res.status(404).send({ message });
    }

    const property = await db.ref(`/properties/${propertyId}`).once('value');

    if (!property.exists()) {
      const message = 'invalid propertyId';
      return res.status(404).send({ message });
    }

    // Reject impropertly stuctured request body
    if (!apikey || !authToken) {
      let message = '';

      if (!body) {
        message = 'invalid request';
        log.error(`${PREFIX} request badly formed`);
      } else {
        message += 'Trello Token Handler requires:';

        if (!apikey) {
          message += ' apikey';
          log.error(`${PREFIX} request body missing apikey`);
        }

        if (!authToken) {
          message += ' authToken';
          log.error(`${PREFIX} request body missing authToken`);
        }
      }

      return res.status(400).send({ message });
    }

    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    let memberID;
    try {
      const response = await got(
        `https://api.trello.com/1/tokens/${authToken}?key=${apikey}`
      );
      const responseBody = JSON.parse(response.body);
      memberID =
        responseBody && responseBody.idMember ? responseBody.idMember : null;
    } catch (err) {
      log.error(`${PREFIX} Error retrieving trello data: ${err}`);
      return res.status(401).send({ message: 'trello request not authorized' });
    }

    try {
      // Persist Trello credentials to system DB
      await systemModel.upsertPropertyTrelloCredentials(db, {
        propertyId,
        member: memberID,
        authToken,
        apikey,
        user: user.id,
      });
    } catch (err) {
      log.error(`${PREFIX} Error saving users trello ID: ${err}`);
      return res.status(400).send({ message: 'Error saving users trello ID' });
    }

    res.status(201).send({ message: 'successfully saved trello token' });
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post(
    '/integrations/trello/:propertyId/authorization',
    authUser(db, auth, true),
    createTrelloTokenHandler
  );
  return app;
};
