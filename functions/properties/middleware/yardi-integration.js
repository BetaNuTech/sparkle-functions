const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationModel = require('../../models/integrations');

const PREFIX = 'properties: middleware: yardi-integration:';

/**
 * Factory for middleware to lookup
 * a yardi configuration for the organization
 * @param {admin.firestore} db
 * @return {Function} - onRequest handler
 */
module.exports = db => {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  return async (req, res, next) => {
    let yardiConfig = null;

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Lookup Yardi Credentials
    try {
      const yardiSnap = await systemModel.findYardi(db);
      yardiConfig = yardiSnap.data() || null;
      if (!yardiConfig) throw Error('Yardi not configured for organization');
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      next(err);
      return res.status(403).send({
        errors: [
          {
            detail: 'Organization not configured for Yardi',
          },
        ],
      });
    }

    // Lookup Yardi Integration Details
    try {
      const yardiDetailsSnap = await integrationModel.findYardi(db);
      const yardiDetails = yardiDetailsSnap.data() || null;
      if (!yardiDetails) {
        throw Error(
          'Yardi integration details not configured for organization'
        );
      }
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      next(err);
      return res.status(403).send({
        errors: [
          {
            detail: 'Organization details not configured for Yardi',
          },
        ],
      });
    }

    req.yardiConfig = yardiConfig;
    next();
  };
};
