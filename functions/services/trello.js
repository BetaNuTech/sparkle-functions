const got = require('got');
const assert = require('assert');

const PREFIX = 'services: trello:';
const DELETED_TRELLO_CARD_ERR_CODE = 'ERR_TRELLO_CARD_DELETED';

module.exports = {
  /**
   * Request token information for a client
   * provided auth token and api key
   * @param  {String} authToken
   * @param  {String} apiKey
   * @return {Promise} - resolves {Object} response body
   */
  async fetchToken(authToken, apiKey) {
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/tokens/${authToken}?key=${apiKey}`
      );
    } catch (err) {
      throw Error(`${PREFIX} fetchToken: Trello API request failed`);
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchToken: failed to parse Trello API response JSON`
      );
    }

    // Lookup Member ID
    if (!responseBody || !responseBody.idMember) {
      throw Error(`${PREFIX} fetchToken: Trello member ID was not recovered`);
    }

    return responseBody;
  },

  /**
   * Request Trello member record from Trello API
   * @param  {String}  memberId
   * @param  {String}  authToken
   * @param  {String}  apiKey
   * @return {Promise} - resolves {Object} response body
   */
  async fetchMemberRecord(memberId, authToken, apiKey) {
    assert(memberId && typeof memberId === 'string', 'has member id');
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/members/${memberId}?key=${apiKey}&token=${authToken}`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} fetchMemberRecord: Trello API request failed: ${err}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchMemberRecord: failed to parse Trello API response JSON`
      );
    }

    if (!responseBody || !responseBody.username) {
      throw Error(`${PREFIX} fetchMemberRecord: did not get expected response`);
    }

    return responseBody;
  },

  /**
   * Fetch all Trello boards for member of
   * provided athentication credentials
   * @param  {String}  authToken
   * @param  {String}  apiKey
   * @return {Promise} - resolves {Object} response body
   */
  async fetchAllBoards(authToken, apiKey) {
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${authToken}`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} fetchAllBoards: Trello API request failed: ${err}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchAllBoards: failed to parse Trello API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Request all a members' Trello organizations
   * @param  {String}  memberId - Trello Member ID
   * @param  {String}  authToken
   * @param  {String}  apiKey
   * @return {Promise} - resolves {Object} response body
   */
  async fetchAllOrganizations(memberId, authToken, apiKey) {
    assert(memberId && typeof memberId === 'string', 'has member id');
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/members/${memberId}/organizations?key=${apiKey}&token=${authToken}&limit=1000`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} fetchAllOrganizations: Trello API request failed: ${err}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchAllOrganizations: failed to parse Trello API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Request all Trello lists belonging to a given board
   * @param  {String}  boardId
   * @param  {String}  authToken
   * @param  {String}  apiKey
   * @return {Promise} - resolves {Object} response body
   */
  async fetchBoardLists(boardId, authToken, apiKey) {
    assert(boardId && typeof boardId === 'string', 'has board id');
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/boards/${boardId}/lists?key=${apiKey}&token=${authToken}`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} fetchBoardLists: Trello API request failed: ${err}`
      );
    }

    let responseBody = null;
    try {
      responseBody = JSON.parse(response.body);
    } catch (err) {
      throw Error(
        `${PREFIX} fetchBoardLists: failed to parse Trello API response JSON`
      );
    }

    return responseBody;
  },

  /**
   * Publish a comment to an existing Trello Card
   * @param  {String}  cardId
   * @param  {String}  authToken
   * @param  {String}  apiKey
   * @param  {String}  text
   * @return {Promise}
   */
  async publishTrelloCardComment(cardId, authToken, apiKey, text) {
    assert(cardId && typeof cardId === 'string', 'has trello card id');
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');
    assert(text && typeof text === 'string', 'has comment text');

    try {
      await got(
        `https://api.trello.com/1/cards/${cardId}/actions/comments?key=${apiKey}&token=${authToken}&text=${encodeURIComponent(
          text
        )}`,
        {
          responseType: 'json',
          method: 'POST',
        }
      );
    } catch (err) {
      const resultErr = Error(
        `${PREFIX} publishTrelloCardComment: POST to trello API card: "${cardId}" comments failed: ${err}`
      );

      // Handle Deleted Trello card
      if (err.statusCode === 404) {
        resultErr.code = DELETED_TRELLO_CARD_ERR_CODE;
      }

      throw resultErr;
    }
  },

  /**
   * POST an attachment to a Trello Card
   * @param  {String} cardId
   * @param  {String} authToken
   * @param  {String} apiKey
   * @param  {String} url
   * @return {Promise} - resolves {Object} response
   */
  async publishCardAttachment(cardId, authToken, apiKey, url) {
    assert(cardId && typeof cardId === 'string', 'has trello card id');
    assert(authToken && typeof authToken === 'string', 'has auth token');
    assert(apiKey && typeof apiKey === 'string', 'has api key');
    assert(url && typeof url === 'string', 'has attachment image url');

    let response = null;
    try {
      response = await got(
        `https://api.trello.com/1/cards/${cardId}/attachments?key=${apiKey}&token=${authToken}&url=${encodeURIComponent(
          url
        )}`,
        {
          responseType: 'json',
          method: 'POST',
          json: true,
        }
      );
    } catch (err) {
      const resultErr = Error(
        `${PREFIX}: publishCardAttachment: POST attachment card: ${cardId} request to trello API failed: ${err}`
      );

      // Set Deleted Trello card error code
      if (err.statusCode === 404) {
        resultErr.code = DELETED_TRELLO_CARD_ERR_CODE;
      }

      throw resultErr;
    }

    return response;
  },
};
