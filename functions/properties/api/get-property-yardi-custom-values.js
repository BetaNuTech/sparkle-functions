const assert = require('assert');
const log = require('../../utils/logger');
const yardi = require('../../services/yardi');
const createYardiErrHandler = require('../utils/send-yardi-error');

const PREFIX = 'properties: api: get-property-yardi-custom-values:';

/**
 * Factory for creating a GET endpoint
 * that fetches the Yardi work order values
 * (priorities, categories, statuses, reasons)
 * accepted when creating or editing work orders
 * @return {Function} - onRequest handler
 */
module.exports = function createGetYardiCustomValues() {
  /**
   * Handle GET request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    assert(req.property, 'has property set by middleware');
    assert(req.yardiConfig, 'has yardi config set by middleware');
    const { property, yardiConfig } = req;
    const sendYardiError = createYardiErrHandler(PREFIX, res);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`${PREFIX} Yardi custom values requested`);

    // Lookup custom values
    let customValues = null;
    try {
      customValues = await yardi.getYardiCustomValues(yardiConfig);
    } catch (err) {
      return sendYardiError(
        err,
        'Unexpected error fetching Yardi values, please try again'
      );
    }

    // Success
    res.status(200).send({
      data: {
        id: property.code,
        type: 'yardi-custom-values',
        attributes: customValues,
      },
    });
  };
};
