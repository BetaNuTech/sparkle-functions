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
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnUpsertTrelloTokenHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * Write /trelloTokens to integration/trello
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { user, body } = req;
    const { apikey, authToken } = body;

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

    // Recover Trello Member ID
    let memberID;
    try {
      const response = await got(
        `https://api.trello.com/1/tokens/${authToken}?key=${apikey}`
      );
      const responseBody = JSON.parse(response.body);

      // Lookup Member ID
      if (responseBody && responseBody.idMember) {
        memberID = responseBody.idMember;
      } else {
        throw Error('Trello member ID was not recovered');
      }
    } catch (err) {
      log.error(`${PREFIX} Error retrieving trello token: ${err}`);
      return res
        .status(401)
        .send({ message: 'trello token request not authorized' });
    }

    // Recover Trello username
    let trelloUsername = '';
    let trelloEmail = '';
    let trelloFullName = '';
    try {
      const response = await got(
        `https://api.trello.com/1/members/${memberID}?key=${apikey}&token=${authToken}`
      );
      const responseBody = JSON.parse(response.body);

      // Lookup username
      if (responseBody && responseBody.username) {
        trelloUsername = responseBody.username;
        trelloEmail = responseBody.email || ''; // optional
        trelloFullName = responseBody.fullName || ''; // optional
      } else {
        throw Error('Trello username was not recovered');
      }
    } catch (err) {
      log.error(`${PREFIX} Error retrieving trello member: ${err}`);
      return res
        .status(401)
        .send({ message: 'trello member request not authorized' });
    }

    try {
      // Persist Trello credentials to system DB
      await systemModel.upsertPropertyTrelloCredentials(db, {
        member: memberID,
        authToken,
        apikey,
        user: user.id,
        trelloUsername,
        trelloEmail,
        trelloFullName,
      });
    } catch (err) {
      log.error(`${PREFIX} Error saving trello credentials: ${err}`);
      return res
        .status(500)
        .send({ message: 'Error saving trello credentials' });
    }

    res.status(201).send({ message: 'successfully saved trello token' });
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post(
    '/integrations/trello/authorization',
    authUser(db, auth, true),
    handler
  );
  return app;
};
