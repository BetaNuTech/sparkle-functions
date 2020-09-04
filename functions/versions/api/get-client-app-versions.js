const assert = require('assert');
const integrationsModel = require('../../models/integrations');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'versions: api: get-client-app-versions:';

/**
 * Factory for creating a GET endpoint
 * that returns the client app versions
 * @param {admin.firebase} fs
 * @return {Function} - onRequest handler
 */
module.exports = function createGetClientApps(fs) {
  assert(Boolean(fs), 'has firestore database');

  /**
   * Handle GET request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const send500Error = create500ErrHandler(PREFIX, res);

    const clientApps = [];

    // Load client app data
    try {
      const clientAppSnaps = await integrationsModel.getClientApps(fs);

      if (clientAppSnaps && clientAppSnaps.docs) {
        clientAppSnaps.docs.forEach(clientAppDoc => {
          clientApps.push({
            id: clientAppDoc.id,
            version: (clientAppDoc.data() || {}).version || '',
            requiredVersion: (clientAppDoc.data() || {}).requiredVersion || '',
          });
        });
      }
    } catch (err) {
      return send500Error(
        err,
        'Client app lookup failed',
        'Unexpected error fetching latest app versions, please try again'
      );
    }

    // Add versions to payload
    const payload = {};
    clientApps.forEach(({ id: clientName, version, requiredVersion }) => {
      payload[clientName] = version;

      if (clientName === 'ios' && requiredVersion) {
        payload.required_ios_version = requiredVersion;
      }
    });

    // Success
    res.status(200).send(payload);
  };
};
