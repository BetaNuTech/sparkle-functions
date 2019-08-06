const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');

const PREFIX = 'trello: get all boards:';

/**
 * Factory for getting all trello boards
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetAllTrelloBoardsHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * get all trello boards for the user requesting
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { user } = req;

    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    let trelloCredentials = null;
    try {
      const savedTokenCredentials = await systemModel.findTrelloCredentials(db);

      if (!savedTokenCredentials.exists()) {
        return res.status(404).send({ message: 'User trello token not found' });
      }

      trelloCredentials = savedTokenCredentials.val();

      if (user.id !== trelloCredentials.user) {
        return res
          .status(401)
          .send({ message: 'This user never created this auth token' });
      }
    } catch (err) {
      log.error(`${PREFIX} Error accessing trello token: ${err}`);
      return res.status(401).send({ message: 'Error accessing trello token' });
    }

    let usersBoards;
    try {
      const trelloResponse = await got(
        `https://api.trello.com/1/members/me/boards?key=${trelloCredentials.apikey}&token=${trelloCredentials.authToken}`
      );

      usersBoards = JSON.parse(trelloResponse.body);

      if (!usersBoards || usersBoards.length < 1) {
        const message = 'User has no trello boards';
        return res.status(404).send({ message });
      }
    } catch (error) {
      log.error(`${PREFIX} Error retrieved from Trello API: ${error}`);
      return res.status(error.statusCode || 500).send({
        message: 'Error from trello API',
      });
    }

    res.status(200).send({
      data: usersBoards
        .filter(({ id, name }) => Boolean(id && name))
        .map(({ id, name }) => ({
          id,
          type: 'trello-board',
          attributes: { name },
        })),
    });
  };

  // Create express app with single GET endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.get('/integrations/trello/boards', authUser(db, auth, true), handler);
  return app;
};
