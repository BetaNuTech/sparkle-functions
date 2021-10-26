const assert = require('assert');
const log = require('../../utils/logger');
const deficiencyModel = require('../../models/deficient-items');
const updateItem = require('../utils/update-deficient-item');
const canUserTransitionDeficientItem = require('../utils/can-user-transition-deficient-item-state');
const validateUpdate = require('../utils/validate-deficient-item-update');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const unflatten = require('../../utils/unflatten-string-attrs');

const PREFIX = 'deficient-items: api: put batch:';

/**
 * Factory for client requested Deficiency
 * archiving on DI state updates
 * @param  {admin.firestore} fs
 * @return {Function} - Express middleware
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
    const { user } = req;
    const userId = (user || {}).id || '';
    const srcUpdatedAt = req.query.updatedAt || '0';
    const parsedUpdatedAt = parseInt(srcUpdatedAt, 10) || 0;
    const hasUpdates = Boolean(Object.keys(update || {}).length);
    const isValidUpdate = hasUpdates
      ? validateUpdate(update).length === 0
      : false;
    const srcDeficiencyIds = (req.query || {}).id || '';
    const deficiencyIds = Array.isArray(srcDeficiencyIds)
      ? srcDeficiencyIds
      : [srcDeficiencyIds];

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    log.info(
      `PUT deficienc${
        deficiencyIds.length > 1 ? 'ies' : 'y'
      }: ${deficiencyIds.map(id => `"${id}"`).join(', ')}`
    );

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

    // Reject bad payload
    if (!isValidUpdate) {
      return res.status(400).send({
        errors: [
          {
            detail:
              'Bad Request: Update is not valid, please provide acceptable payload',
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
        'deficient items lookup failed',
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

    // Collect all updates into individual parts
    const updateCopy = JSON.parse(JSON.stringify(update));
    const completedPhotos = updateCopy.completedPhotos || null;
    delete updateCopy.completedPhotos;
    const progressNote = updateCopy.progressNote || '';
    delete updateCopy.progressNote;
    const updatedAt = parsedUpdatedAt || Math.round(Date.now() / 1000);

    // Collect updates to deficient items
    const notUpdated = [];
    const updateResults = [];
    const batch = fs.batch();
    for (let i = 0; i < deficiencies.length; i++) {
      const deficiency = deficiencies[i];
      const deficiencyId = deficiency.id;
      const deficiencyUpdates = updateItem(
        deficiency,
        updateCopy,
        userId,
        updatedAt,
        progressNote,
        completedPhotos
      );
      const hasDeficiencyUpdates = Boolean(
        Object.keys(deficiencyUpdates || {}).length
      );

      if (hasDeficiencyUpdates) {
        try {
          await deficiencyModel.updateRecord(
            fs,
            deficiencyId,
            deficiencyUpdates,
            batch
          );
          updateResults.push({
            id: deficiencyId,
            attributes: unflatten(deficiencyUpdates),
          });
        } catch (err) {
          return send500Error(
            err,
            `failed to update deficiency "${deficiencyId}"`,
            'failed to persist updates'
          );
        }
      } else {
        log.warn(
          `${PREFIX} attempted to modify deficiency "${deficiencyId}" with invalid update`
        );
        notUpdated.push(deficiencyId);
      }
    }

    // Check user permission to update all state transitions
    const updateStates = updateResults
      .map(({ attributes }) => attributes.state || '')
      .filter(Boolean);
    const userHasPermissionForUpdate = updateStates.every(state =>
      canUserTransitionDeficientItem(user, state)
    );
    if (!userHasPermissionForUpdate) {
      return res.status(403).send({
        errors: [
          {
            detail:
              'Forbidden: you do not have permission to make the requested state transition',
          },
        ],
      });
    }

    // Commit all updates in batched transation
    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        'batch updates failed to commit',
        'unexpected error'
      );
    }

    // Create JSON API response
    const payload = { data: [], meta: { warnings: [] } };

    // Append warnings for deficiencies that were not changed
    notUpdated.forEach(deficiencyId => {
      payload.meta.warnings.push({
        id: deficiencyId,
        type: 'deficient-item',
        detail: 'update not applicable and no changes persisted for record',
      });
    });

    //
    if (!updateResults.length) {
      delete payload.data;
      payload.errors = [
        {
          title: 'No Change',
          detail: 'Bad Request: update had no affect',
        },
      ];
      return res.status(409).send(payload);
    }

    // Append all deficiency updates to response data
    updateResults.forEach(({ id, attributes }) =>
      payload.data.push({ id, type: 'deficient-item', attributes })
    );

    // Success response
    res.status(200).send(payload);
  };
};
