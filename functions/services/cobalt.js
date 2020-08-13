const got = require('got');
const assert = require('assert');
const config = require('../config');
const systemModel = require('../models/system');

const { cobalt } = config;
const PREFIX = 'services: cobalt:';

module.exports = {
  /**
   * Request all Cobalt Tenant data for a property
   * @param  {admin.firestore} fs - Firestore Admin DB instance
   * @param  {String} propertyCode
   * @returns {Promise} - resolves {Object}
   */
  async getPropertyTenants(fs, propertyCode) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property code'
    );

    if (!cobalt.domain) {
      throw Error(`${PREFIX} Cobalt Domain not configured`);
    }

    let token = '';

    // Lookup Cobalt credentials
    // TODO: move to parent scopes
    try {
      const credentialsSnap = await systemModel.firestoreFindCobalt(fs);
      const credentials = credentialsSnap.data() || null;

      if (!credentials || !credentials.token) {
        throw Error('Missing Credentials');
      }

      token = credentials.token;
    } catch (err) {
      throw Error(`${PREFIX} Cobalt Integration not setup: ${err}`);
    }

    // GET Cobalt Tenant data
    let response = null;
    try {
      response = await got(
        `${
          cobalt.domain
        }/collections_by_tenant_details/json_api?token=${encodeURIComponent(
          token
        )}&property_code=${encodeURIComponent(propertyCode)}`
      );
      const { statusCode } = response;
      if (statusCode !== 200) {
        throw Error(`Request failed with status "${statusCode}"`);
      }
    } catch (err) {
      throw Error(`${PREFIX} Cobalt Request Failure: ${err}`);
    }

    let result = null;

    // Parse JSON response
    try {
      result = JSON.parse(response.body);
    } catch (err) {
      throw Error(`${PREFIX} Cobalt Response Parse Failure: ${err}`);
    }

    return result;
  },
};
