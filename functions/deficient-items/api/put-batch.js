const assert = require('assert');
// const log = require('../../utils/logger');
const deficiencyModel = require('../../models/deficient-items');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'deficient-items: api: put batch:';

/**
 * Factory for client requested Deficiency
 * archiving on DI state updates
 * @param  {admin.firestore} fs
 * @return {Function} - property onWrite handler
 */
module.exports = function createPutDeficiencyBatch(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle PUT request for updating
   * one or more deficient items
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const send500Error = create500ErrHandler(PREFIX, res);
    const update = body;
    // const userId = (req.user || {}).id || '';
    const hasUpdates = Boolean(Object.keys(update || {}).length);
    const srcDeficiencyIds = (req.query || {}).id || '';
    const deficiencyIds = Array.isArray(srcDeficiencyIds)
      ? srcDeficiencyIds
      : [srcDeficiencyIds];
    const hasDeficiencyIds = Boolean(
      Array.isArray(deficiencyIds) &&
        deficiencyIds.length &&
        deficiencyIds.every(id => id && typeof id === 'string')
    );

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    // Reject missing, required, deficient item ids
    if (!hasDeficiencyIds) {
      return res.status(400).send({
        errors: [
          {
            detail:
              'Bad Request: One or more deficient item ids must be provided as query params',
          },
        ],
      });
    }

    if (deficiencyIds.length > 10) {
      return res.status(400).send({
        errors: [
          {
            detail:
              'Bad Request: you may only update 10 deficient items at a time',
          },
        ],
      });
    }

    // Reject missing update request JSON
    if (!hasUpdates) {
      return res.status(400).send({
        errors: [
          {
            detail: 'Bad Request: deficient item update body required',
          },
        ],
      });
    }

    // Lookup deficincies
    const deficiencies = [];
    try {
      const deficienciesSnap = await deficiencyModel.findMany(
        fs,
        ...deficiencyIds
      );
      deficienciesSnap.docs.forEach(doc =>
        deficiencies.push({ ...doc.data(), id: doc.id })
      );
    } catch (err) {
      return send500Error(
        err,
        'deficient item lookup failed',
        'unexpected error'
      );
    }

    // Reject when *any* invalid deficiencies provided
    if (deficiencies.length !== deficiencyIds.length) {
      const foundIds = deficiencies.map(({ id }) => id);
      const missingIds = deficiencyIds.filter(id => !foundIds.includes(id));

      return res.status(404).send({
        errors: [
          {
            source: { pointer: missingIds.join(',') },
            title: 'Not Found',
            detail: `could not find ${missingIds.length} deficient item${
              missingIds.length > 1 ? 's' : ''
            }`,
          },
        ],
      });
    }

    // Success response
    res.status(200).send({ message: 'successful' });
  };
};
