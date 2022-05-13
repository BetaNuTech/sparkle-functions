const assert = require('assert');
const log = require('../../utils/logger');
const trello = require('../../services/trello');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'trello: api: get-board-lists:';

/**
 * Factory for getting all trello board lists
 * @param  {admin.firestore} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetAllTrelloBoardListsHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * get all trello board lists for the user requesting
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, params, trelloCredentials } = req;
    const boardId = (params || {}).boardId || '';
    const send500Error = create500ErrHandler(PREFIX, res);

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Request lists for Trello board
    let usersBoardLists = null;
    try {
      usersBoardLists = await trello.fetchBoardLists(
        boardId,
        trelloCredentials.authToken,
        trelloCredentials.apikey
      );

      if (!usersBoardLists || usersBoardLists.length < 1) {
        return res.status(404).send({
          errors: [{ detail: 'This trello board has no lists' }],
        });
      }
    } catch (err) {
      return send500Error(
        err,
        `Error retrieved from Trello API | ${err}`,
        'Error from trello API'
      );
    }

    res.status(200).send({
      data: usersBoardLists
        .filter(({ id, name }) => Boolean(id && name))
        .map(({ id, name }) => ({
          id,
          type: 'trello-list',
          attributes: { name },
          relationships: {
            board: {
              id: boardId,
              type: 'trello-board',
            },
          },
        })),
    });
  };
};
