const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');

const PREFIX = 'trello: get authorizor:';

/**
 * Factory for getting Trello authorizor details
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetAllTrelloBoardsHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * Lookup authorizor data of organizations
   * Trello credentials
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { user } = req;
    const payload = { data: {} };

    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.findTrelloCredentials(db);

      if (!trelloCredentialsSnap.exists()) {
        return res.status(200).send(payload); // send empty response
      }

      trelloCredentials = trelloCredentialsSnap.val();
    } catch (err) {
      log.error(`${PREFIX} Error accessing trello token: ${err}`);
      return res.status(500).send({
        errors: [
          {
            status: 500,
            source: {},
            title: 'Unexpected Error',
            detail: 'Failed to access trello integration credentials',
          },
        ],
      });
    }

    // Populate payload data
    Object.assign(payload.data, {
      type: 'user',
      id: trelloCredentials.user,
      attributes: {
        fullName: trelloCredentials.trelloFullName,
        trelloUsername: trelloCredentials.trelloUsername,
        trelloMember: trelloCredentials.member,
      },
    });

    // Append optional email attribute
    if (trelloCredentials.trelloEmail) {
      payload.data.attributes.email = trelloCredentials.trelloEmail;
    }

    res.status(200).send(payload);
  };

  // Create express app with single GET endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.get('/integrations/trello', authUser(db, auth, true), handler);

  return app;
};
