const assert = require('assert');
const log = require('../../utils/logger');
const clickup = require('../../services/clickup');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'clickup: api: get-spaces:';

/**
 * Factory for getting all spaces in a ClickUp workspace
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetClickUpSpaces(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * GET all spaces for a specific ClickUp workspace
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, clickupCredentials, params } = req;
    const workspaceId = params.workspaceId || '';
    const send500Error = create500ErrHandler(PREFIX, res);

    log.info(
      `${PREFIX} requested by user: "${user.id}" for workspace: "${workspaceId}"`
    );

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Validate ClickUp credentials
    if (!clickupCredentials || !clickupCredentials.apiToken) {
      return res.status(400).send({
        errors: [{ detail: 'Organization has not authorized ClickUp' }],
      });
    }

    // Validate workspace ID
    if (!workspaceId) {
      return res.status(400).send({
        errors: [{ detail: 'workspaceId is required' }],
      });
    }

    // Request spaces for the workspace
    let spaces = null;
    try {
      const spacesResponse = await clickup.fetchSpaces(
        clickupCredentials.apiToken,
        workspaceId
      );
      spaces = spacesResponse.spaces || [];
    } catch (err) {
      return send500Error(
        err,
        `ClickUp API request failed | ${err}`,
        'ClickUp API request failed'
      );
    }

    // Also get folders for each space (to include hierarchy)
    const spacesWithHierarchy = await Promise.all(
      spaces.map(async space => {
        try {
          const foldersResponse = await clickup.fetchFolders(
            clickupCredentials.apiToken,
            space.id
          );
          return {
            ...space,
            folders: foldersResponse.folders || [],
          };
        } catch (err) {
          log.error(
            `${PREFIX} Failed to fetch folders for space ${space.id}: ${err}`
          );
          return {
            ...space,
            folders: [],
          };
        }
      })
    );

    // Successful response
    res.status(200).send({
      data: spacesWithHierarchy
        .filter(({ id, name }) => Boolean(id && name))
        .map(space => ({
          id: space.id,
          type: 'clickup-space',
          attributes: {
            name: space.name,
            color: space.color || '#7b68ee',
            avatar: space.avatar || null,
            private: space.private || false,
            statusCount: space.statuses ? space.statuses.length : 0,
            multipleAssignees: space.multiple_assignees || false,
            folderCount: space.folders ? space.folders.length : 0,
          },
        })),
    });
  };
};
