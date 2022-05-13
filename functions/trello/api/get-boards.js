const assert = require('assert');
const log = require('../../utils/logger');
const trello = require('../../services/trello');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'trello: api: get-boards:';

/**
 * Factory for getting all trello boards
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetAllTrelloBoards(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * GET all trello boards for the user requesting
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, trelloCredentials } = req;
    const send500Error = create500ErrHandler(PREFIX, res);

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Request user's Trello boards
    let boards = null;
    try {
      boards = await trello.fetchAllBoards(
        trelloCredentials.authToken,
        trelloCredentials.apikey
      );

      if (!boards || boards.length < 1) {
        return res.status(404).send({
          errors: [{ detail: 'User has no trello boards' }],
        });
      }
    } catch (err) {
      return send500Error(
        err,
        `Error from Trello API member boards | ${err}`,
        'Error from trello API member boards'
      );
    }

    // Request user's Trello organizations
    let organizations = null;
    try {
      organizations = await trello.fetchAllOrganizations(
        trelloCredentials.member,
        trelloCredentials.authToken,
        trelloCredentials.apikey
      );
    } catch (err) {
      log.error(
        `${PREFIX} Error from Trello API member organizations | ${err}`
      );
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
