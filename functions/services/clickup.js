const got = require('got');
const assert = require('assert');

const PREFIX = 'services: clickup:';
const API_BASE_URL = 'https://api.clickup.com/api/v2';

module.exports = {
  /**
   * Get authorized teams (workspaces) for the API token
   * @param  {String} apiToken - ClickUp API token
   * @return {Promise} - resolves {Object} response body
   */
  async fetchTeams(apiToken) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/team`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchTeams: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchTeams: failed to parse ClickUp API response JSON`
      );
    }

    if (!responseBody || !responseBody.teams) {
      throw Error(`${PREFIX} fetchTeams: ClickUp teams were not recovered`);
    }

    return responseBody;
  },

  /**
   * Get spaces for a specific team
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} teamId - Team/workspace ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchSpaces(apiToken, teamId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(teamId && typeof teamId === 'string', 'has team id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/team/${teamId}/space`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchSpaces: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchSpaces: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get lists for a specific space
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} spaceId - Space ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchLists(apiToken, spaceId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(spaceId && typeof spaceId === 'string', 'has space id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/space/${spaceId}/list`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchLists: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchLists: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get details for a specific list (includes statuses)
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} listId - List ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchList(apiToken, listId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(listId && typeof listId === 'string', 'has list id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/list/${listId}`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchList: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchList: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Create a new task in a list
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} listId - List ID
   * @param  {Object} taskData - Task creation data
   * @return {Promise} - resolves {Object} response body
   */
  async createTask(apiToken, listId, taskData) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(listId && typeof listId === 'string', 'has list id');
    assert(taskData && typeof taskData === 'object', 'has task data');

    let response = null;
    try {
      response = await got.post(`${API_BASE_URL}/list/${listId}/task`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} createTask: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} createTask: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Update an existing task
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} taskId - Task ID
   * @param  {Object} updateData - Task update data
   * @return {Promise} - resolves {Object} response body
   */
  async updateTask(apiToken, taskId, updateData) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(taskId && typeof taskId === 'string', 'has task id');
    assert(updateData && typeof updateData === 'object', 'has update data');

    let response = null;
    try {
      response = await got.put(`${API_BASE_URL}/task/${taskId}`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} updateTask: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} updateTask: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Create a new space in a team
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} teamId - Team/workspace ID
   * @param  {Object} spaceData - Space creation data
   * @return {Promise} - resolves {Object} response body
   */
  async createSpace(apiToken, teamId, spaceData) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(teamId && typeof teamId === 'string', 'has team id');
    assert(spaceData && typeof spaceData === 'object', 'has space data');

    let response = null;
    try {
      response = await got.post(`${API_BASE_URL}/team/${teamId}/space`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(spaceData),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} createSpace: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} createSpace: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Create a new folder in a space
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} spaceId - Space ID
   * @param  {Object} folderData - Folder creation data
   * @return {Promise} - resolves {Object} response body
   */
  async createFolder(apiToken, spaceId, folderData) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(spaceId && typeof spaceId === 'string', 'has space id');
    assert(folderData && typeof folderData === 'object', 'has folder data');

    let response = null;
    try {
      response = await got.post(`${API_BASE_URL}/space/${spaceId}/folder`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(folderData),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} createFolder: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} createFolder: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Create a new list in a folder
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} folderId - Folder ID
   * @param  {Object} listData - List creation data
   * @return {Promise} - resolves {Object} response body
   */
  async createList(apiToken, folderId, listData) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(folderId && typeof folderId === 'string', 'has folder id');
    assert(listData && typeof listData === 'object', 'has list data');

    let response = null;
    try {
      response = await got.post(`${API_BASE_URL}/folder/${folderId}/list`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listData),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} createList: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} createList: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get folders for a specific space
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} spaceId - Space ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchFolders(apiToken, spaceId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(spaceId && typeof spaceId === 'string', 'has space id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/space/${spaceId}/folder`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchFolders: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchFolders: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get lists for a specific folder
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} folderId - Folder ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchFolderLists(apiToken, folderId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(folderId && typeof folderId === 'string', 'has folder id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/folder/${folderId}/list`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchFolderLists: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchFolderLists: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get tasks for a specific list
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} listId - List ID
   * @param  {Object} options - Query options (include_closed, etc.)
   * @return {Promise} - resolves {Object} response body
   */
  async fetchTasks(apiToken, listId, options = {}) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(listId && typeof listId === 'string', 'has list id');

    // Build query string
    const queryParams = new URLSearchParams();
    if (options.include_closed !== false) {
      queryParams.append('include_closed', 'true');
    }
    if (options.archived !== undefined) {
      queryParams.append('archived', options.archived.toString());
    }

    const queryString = queryParams.toString();
    const url = `${API_BASE_URL}/list/${listId}/task${
      queryString ? `?${queryString}` : ''
    }`;

    let response = null;
    try {
      response = await got(url, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchTasks: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchTasks: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get a specific task by ID
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} taskId - Task ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchTask(apiToken, taskId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(taskId && typeof taskId === 'string', 'has task id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/task/${taskId}`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchTask: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchTask: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Get members for a specific list
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} listId - List ID
   * @return {Promise} - resolves {Object} response body
   */
  async fetchListMembers(apiToken, listId) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(listId && typeof listId === 'string', 'has list id');

    let response = null;
    try {
      response = await got(`${API_BASE_URL}/list/${listId}/member`, {
        headers: {
          Authorization: apiToken,
        },
      });
    } catch (err) {
      throw Error(
        `${PREFIX} fetchListMembers: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchListMembers: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Add comment to a task
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} taskId - Task ID
   * @param  {Object} commentData - Comment data
   * @return {Promise} - resolves {Object} response body
   */
  async addTaskComment(apiToken, taskId, commentData) {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(taskId && typeof taskId === 'string', 'has task id');
    assert(commentData && typeof commentData === 'object', 'has comment data');

    let response = null;
    try {
      response = await got.post(`${API_BASE_URL}/task/${taskId}/comment`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commentData),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} addTaskComment: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} addTaskComment: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Update list statuses to match Sparkle workflow
   * @param  {String} apiToken - ClickUp API token
   * @param  {String} listId - List ID
   * @param  {String} type - 'deficiency' or 'job'
   * @return {Promise} - resolves {Object} response body
   */
  async setupListStatuses(apiToken, listId, type = 'deficiency') {
    assert(apiToken && typeof apiToken === 'string', 'has api token');
    assert(listId && typeof listId === 'string', 'has list id');

    const statusConfigs =
      type === 'job'
        ? {
            statuses: [
              { status: 'NEEDS REVIEW', type: 'open', color: '#f9cb9c' },
              { status: 'APPROVED', type: 'custom', color: '#4dc3ff' },
              { status: 'AUTHORIZED', type: 'done', color: '#02c39a' },
              { status: 'COMPLETE', type: 'closed', color: '#008844' },
            ],
          }
        : {
            statuses: [
              { status: 'TO DO', type: 'open', color: '#d3d3d3' },
              { status: 'IN PROGRESS', type: 'custom', color: '#4194f6' },
              { status: 'NEEDS REVIEW', type: 'done', color: '#f9cb9c' },
              { status: 'ON HOLD', type: 'open', color: '#ff9800' },
              { status: 'REJECTED', type: 'open', color: '#f44336' },
              { status: 'COMPLETE', type: 'closed', color: '#008844' },
            ],
          };

    let response = null;
    try {
      response = await got.put(`${API_BASE_URL}/list/${listId}`, {
        headers: {
          Authorization: apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(statusConfigs),
      });
    } catch (err) {
      throw Error(
        `${PREFIX} setupListStatuses: ClickUp API request failed: ${err.message}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} setupListStatuses: failed to parse ClickUp API response JSON`
      );
    }

    return responseBody;
  },
};
