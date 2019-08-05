const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');

const PREFIX = 'trello: get all board lists:';

/**
 * Factory for getting all trello board lists
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
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
  const getAllTrelloBoardListsHandler = async (req, res) => {
    const { user, params } = req;
    const { boardId } = params;

    if (!boardId) {
      return res
        .status(404)
        .send({ message: 'request missing boardId parameter' });
    }

    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    let trelloCredentials = {};
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
    getAllTrelloBoardListsHandler
  );
  return app;
};
