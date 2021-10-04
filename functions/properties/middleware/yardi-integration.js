const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');

const PREFIX = 'properties: middleware: yardi-integration:';

/**
 * Factory for middleware to lookup
 * a yardi configuration for the organization
 * @param {admin.firestore} fs
 * @return {Function} - onRequest handler
 */
module.exports = fs => {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (req, res, next) => {
    let yardiConfig = null;

    // Lookup Yardi Integration
    try {
      const yardiSnap = await systemModel.findYardi(fs);
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

    req.yardiConfig = yardiConfig;
    next();
  };
};
