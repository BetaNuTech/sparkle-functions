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

    // Lookup Trello Credentials
    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.findTrelloCredentials(db);

      if (!trelloCredentialsSnap.exists()) {
        return res
          .status(404)
          .send({ message: 'Trello credentials not found' });
      }

      trelloCredentials = trelloCredentialsSnap.val();
    } catch (err) {
      log.error(`${PREFIX} Error accessing trello token: ${err}`);
      return res.status(401).send({ message: 'Error accessing trello token' });
    }

    // Revoke unauthorized request for
    // anthor authorizor's Trello boards
    if (user.id !== trelloCredentials.user) {
      return res
        .status(401)
        .send({ message: 'This user never created this auth token' });
    }

    // Request user's Trello boards
    let boards = null;
    try {
      const trelloResponse = await got(
        `https://api.trello.com/1/members/me/boards?key=${trelloCredentials.apikey}&token=${trelloCredentials.authToken}`
      );

      boards = JSON.parse(trelloResponse.body);

      if (!boards || boards.length < 1) {
        const message = 'User has no trello boards';
        return res.status(404).send({ message });
      }
    } catch (err) {
      log.error(`${PREFIX} Error from Trello API member boards: ${err}`);
      return res.status(err.statusCode || 500).send({
        message: 'Error from trello API member boards',
      });
    }

    // Request user's Trello organizations
    let organizations = null;
    try {
      const trelloResponse = await got(
        `https://api.trello.com/1/members/${trelloCredentials.member}/organizations?key=${trelloCredentials.apikey}&token=${trelloCredentials.authToken}&limit=1000`
      );

      organizations = JSON.parse(trelloResponse.body);
    } catch (err) {
      log.error(`${PREFIX} Error from Trello API member organizations: ${err}`);
      organizations = []; // proceed
    }

    // Successful response
    res.status(200).send({
      data: boards
        .filter(({ id, name }) => Boolean(id && name))
        .map(({ id, name }) => ({
          id,
          type: 'trello-board',
          attributes: { name },
          relationships: getBoardRelationships(id, organizations),
        })),

      included: organizations.map(({ id, displayName }) => ({
        id,
        type: 'trello-organization',
        attributes: { name: displayName },
      })),
    });
  };

  // Create express app with single GET endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.get('/integrations/trello/boards', authUser(db, auth, true), handler);
  return app;
};

/**
 * Create a board's JSON API organization
 * relationship if any exist
 * @param  {String} boardId
 * @param  {Object[]} organizations
 * @return {Object} - relationship
 */
function getBoardRelationships(boardId, organizations) {
  const [boardsOrg] = organizations.filter(({ idBoards }) =>
    idBoards.includes(boardId)
  );

  if (boardsOrg) {
    return {
      trelloOrganization: {
        data: { id: boardsOrg.id, type: 'trello-organization' },
      },
    };
  }

  return {};
}
