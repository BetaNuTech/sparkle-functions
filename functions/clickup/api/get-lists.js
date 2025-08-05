const assert = require('assert');
const log = require('../../utils/logger');
const clickup = require('../../services/clickup');
const systemModel = require('../../models/system');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'clickup: api: get-lists:';

/**
 * Factory for browsing folders and lists in a ClickUp space or folder
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createGetClickUpLists(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * GET all folders and lists for browsing ClickUp hierarchy
   * Supports navigation through spaces and nested folders
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, clickupCredentials, query } = req;
    const spaceId = query.spaceId || '';
    const folderId = query.folderId || '';
    const send500Error = create500ErrHandler(PREFIX, res);

    log.info(
      `${PREFIX} requested by user: "${user.id}" for space: "${spaceId}" folder: "${folderId}"`
    );

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Get ClickUp credentials from system model
    let apiToken = null;
    try {
      const clickupSystemDoc = await systemModel.findClickUp(db);
      const clickupData = clickupSystemDoc ? clickupSystemDoc.data() : null;
      apiToken = clickupData ? clickupData.apiToken : null;
    } catch (err) {
      // Fall back to middleware credentials if available
      apiToken = clickupCredentials && clickupCredentials.apiToken ? clickupCredentials.apiToken : null;
    }

    // Validate ClickUp credentials
    if (!apiToken) {
      return res.status(400).send({
        errors: [{ detail: 'Organization has not authorized ClickUp' }],
      });
    }

    // Validate request - need either space or folder ID
    if (!spaceId && !folderId) {
      return res.status(400).send({
        errors: [
          { detail: 'Either spaceId or folderId query parameter is required' },
        ],
      });
    }

    let folders = [];
    let lists = [];

    try {
      // Browse space - get both folders and lists
      if (spaceId && !folderId) {
        // Get folders in the space
        const foldersResponse = await clickup.fetchFolders(
          apiToken,
          spaceId
        );
        folders = foldersResponse.folders || [];

        // Get lists directly in the space (not in folders)
        const listsResponse = await clickup.fetchLists(
          apiToken,
          spaceId,
          false // archived parameter
        );
        lists = listsResponse.lists || [];
      }

      // Browse folder - get subfolders (if any) and lists
      if (folderId) {
        // ClickUp doesn't have a direct "get subfolders" endpoint
        // So we'll just get lists in this folder
        // If ClickUp adds folder nesting support, we'd fetch subfolders here

        const folderListsResponse = await clickup.fetchFolderLists(
          apiToken,
          folderId
        );
        lists = folderListsResponse.lists || [];

        // Note: Currently ClickUp API doesn't support nested folders
        // but we're structuring this to support it if they add it
      }
    } catch (err) {
      return send500Error(
        err,
        `ClickUp API request failed | ${err}`,
        'ClickUp API request failed'
      );
    }

    // Get detailed info for each list (includes statuses)
    const listsWithDetails = await Promise.all(
      lists.map(async list => {
        try {
          const listDetails = await clickup.fetchList(
            apiToken,
            list.id
          );
          // Merge enhanced details with original list data
          return { ...list, ...listDetails };
        } catch (err) {
          log.error(
            `${PREFIX} Failed to fetch list details for ${list.id}: ${err}`
          );
          return list;
        }
      })
    );

    // Combine folders and lists into a single response
    const data = [
      // Folders first (for better UX - folders typically shown before files)
      ...folders
        .filter(({ id, name }) => Boolean(id && name))
        .map(folder => ({
          id: folder.id,
          type: 'clickup-folder',
          attributes: {
            name: folder.name,
            hidden: folder.hidden || false,
            taskCount: folder.task_count || 0,
          },
        })),
      // Then lists
      ...listsWithDetails
        .filter(({ id, name }) => Boolean(id && name))
        .map(list => ({
          id: list.id,
          type: 'clickup-list',
          attributes: {
            name: list.name,
            orderindex: list.orderindex || 0,
            status: list.status || null,
            taskCount: list.task_count || 0,
            statusCount: (list.statuses || []).length,
            hasStatuses: (list.statuses || []).length > 0,
          },
        })),
    ];

    // Build included section for relationships
    const included = [];
    if (spaceId) {
      included.push({
        id: spaceId,
        type: 'clickup-space',
        attributes: {
          data: { id: spaceId, type: 'clickup-space' },
        },
      });
    }
    if (folderId) {
      included.push({
        id: folderId,
        type: 'clickup-folder',
        attributes: {
          data: { id: folderId, type: 'clickup-folder' },
        },
      });
    }

    // Successful response with mixed folders and lists
    const response = { data };
    if (included.length > 0) {
      response.included = included;
    }
    
    res.status(200).send(response);
  };
};
