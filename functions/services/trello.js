const got = require('got');
const assert = require('assert');

const PREFIX = 'services: trello:';

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
};
