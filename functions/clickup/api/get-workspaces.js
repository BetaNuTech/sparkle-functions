const assert = require('assert');
const log = require('../../utils/logger');
const clickup = require('../../services/clickup');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'clickup: api: get-workspaces:';

/**
 * Factory for getting all ClickUp workspaces
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetAllClickUpWorkspaces(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * GET all ClickUp workspaces for the authenticated user
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, clickupCredentials } = req;
    const send500Error = create500ErrHandler(PREFIX, res);

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Validate ClickUp credentials
    if (!clickupCredentials || !clickupCredentials.apiToken) {
      return res.status(400).send({
        errors: [{ detail: 'Organization has not authorized ClickUp' }],
      });
    }

    // Request user's ClickUp workspaces (teams)
    let workspaces = null;
    try {
      const teamsResponse = await clickup.fetchTeams(
        clickupCredentials.apiToken
      );
      workspaces = teamsResponse.teams || [];
    } catch (err) {
      return send500Error(
        err,
        `ClickUp API request failed | ${err}`,
        'ClickUp API request failed'
      );
    }

    // Successful response - return empty array if no workspaces
    res.status(200).send({
      data: workspaces
        .filter(({ id, name }) => Boolean(id && name))
        .map(workspace => ({
          id: workspace.id,
          type: 'clickup-workspace',
          attributes: {
            name: workspace.name,
            color: workspace.color || '#7b68ee',
            avatar: workspace.avatar || null,
            memberCount: workspace.members ? workspace.members.length : 0,
          },
        })),
    });
  };
};
