const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');

const PREFIX = 'properties: middleware: yardi-integration:';

/**
 * Factory for middleware to lookup
 * a yardi configuration for the organization
 * @param {admin.database} db
 * @return {Function} - onRequest handler
 */
module.exports = db => {
  assert(Boolean(db), 'has realtime DB instance');

  return async (req, res, next) => {
    let yardiConfig = null;

    // Lookup Yardi Integration
    try {
      const yardiSnap = await systemModel.findYardiCredentials(db);
      yardiConfig = yardiSnap.val();
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

    req.yardiConfig = yardiConfig;
    next();
  };
};
