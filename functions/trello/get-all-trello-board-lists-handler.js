const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const authTrelloReq = require('../utils/auth-trello-request');

const PREFIX = 'trello: get board lists:';

/**
 * Factory for getting all trello board lists
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetAllTrelloBoardListsHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * get all trello board lists for the user requesting
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { user, params, trelloCredentials } = req;
    const { boardId } = params;

    log.info(`${PREFIX} requested by user: ${user.id}`);

    if (!boardId) {
      return res
        .status(400)
        .send({ message: 'request missing boardId parameter' });
    }

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Request lists for Trello board
    let usersBoardLists;
    try {
      const trelloResponse = await got(
        `https://api.trello.com/1/boards/${boardId}/lists?key=${trelloCredentials.apikey}&token=${trelloCredentials.authToken}`
      );

      usersBoardLists = JSON.parse(trelloResponse.body);

      if (!usersBoardLists || usersBoardLists.length < 1) {
        const message = 'This trello board has no lists';
        return res.status(404).send({ message });
      }
    } catch (error) {
      log.error(`${PREFIX} Error retrieved from Trello API: ${error}`);
      return res.status(error.statusCode || 500).send({
        message: 'Error from trello API',
      });
    }

    res.status(200).send({
      data: usersBoardLists
        .filter(({ id, name }) => Boolean(id && name))
        .map(({ id, name }) => ({
          id,
          type: 'trello-list',
          attributes: { name },
        })),
    });
  };

  // Create express app with single GET endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.get(
    '/integrations/trello/boards/:boardId/lists',
    authUser(db, auth, true),
    authTrelloReq(db),
    handler
  );
  return app;
};
