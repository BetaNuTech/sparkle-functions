const assert = require('assert');
const log = require('../../utils/logger');
const deficiencyModel = require('../../models/deficient-items');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const updateItem = require('../utils/update-deficient-item');
const canUserTransitionDeficientItem = require('../utils/can-user-transition-deficient-item-state');
const validateUpdate = require('../utils/validate-deficient-item-update');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const unflatten = require('../../utils/unflatten-string-attrs');
const configureNotifications = require('../utils/configure-notifications');

const PREFIX = 'deficient-items: api: put batch:';

/**
 * Factory for client requested Deficiency
 * archiving on DI state updates
 * @param  {admin.firestore} db
 * @param  {Boolean} enableProgressNoteNotifications
 * @return {Function} - Express middleware
 */
module.exports = function createPutDeficiencyBatch(
  db,
  enableProgressNoteNotifications
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(
    typeof enableProgressNoteNotifications === 'boolean',
    'has enabled progress note notification feature flag'
  );

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
    const hasDeficiencyIds = Boolean(
      Array.isArray(deficiencyIds) &&
        deficiencyIds.length &&
        deficiencyIds.every(id => id && typeof id === 'string')
    );

    // Is client requesting notifications
    // for their requested updates
    const isNotifying = req.query.notify
      ? req.query.notify.search(/true/i) > -1
      : false;

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    // Reject missing, required, deficient item ids
    if (!hasDeficiencyIds) {
      log.error(
        `${PREFIX} request missing any discoverable deficient item identifiers`
      );
      return res.status(400).send({
        errors: [
          {
            detail:
              'Bad Request: One or more deficient item ids must be provided as query params',
          },
        ],
      });
    }

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
        db,
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
    const originalDeficiencyState = deficiencies[0].state;

    // Collect updates to deficient items
    const notUpdated = [];
    const updateResults = [];
    const batch = db.batch();
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
            db,
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

    // Commit all updates in batched transaction
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

    // Send bad request when
    // updates did not cause any writes
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

    // Client did not request any global
    // notifications for update
    if (!isNotifying || incognitoMode) {
      return;
    }

    log.info(`${PREFIX} creating global notifications for successful update`);

    const notificationsBatch = db.batch();
    const propertyId = deficiencies[0].property;
    const { attributes: appliedUpdates } = updateResults[0];
    const isProgressNoteUpdate = Boolean(appliedUpdates.progressNotes);

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data() || null;
      if (!property) throw Error('Not found');
      property.id = propertyId;
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
      return res.status(400).send({ message: 'body contains bad property' });
    }

    // Lookup updated deficincies
    const updatedDeficiencies = [];
    try {
      const deficienciesSnap = await deficiencyModel.findMany(
        db,
        ...updateResults.map(({ id }) => id)
      );
      deficienciesSnap.docs.forEach(doc =>
        updatedDeficiencies.push({ ...doc.data(), id: doc.id })
      );
    } catch (err) {
      return send500Error(
        err,
        'deficient items lookup failed',
        'unexpected error'
      );
    }

    // Notification configurations ready
    // to be added to the batch update
    const notificationConfigs = [];

    // Add progress note update
    // notifications when they're enabled
    if (
      progressNote &&
      isProgressNoteUpdate &&
      enableProgressNoteNotifications
    ) {
      log.info(`${PREFIX} generating progress note update notifications`);
      const progressNoteNotifications = updatedDeficiencies
        .map(deficientItem => {
          try {
            return configureNotifications.createProgressNote(
              progressNote,
              user,
              property,
              deficientItem
            );
          } catch (err) {
            log.error(
              `${PREFIX} failed to create progress note notification for deficiency: "${deficientItem.id}": ${err}`
            );
          }

          return null;
        })
        .filter(Boolean);

      notificationConfigs.push(...progressNoteNotifications);
    }

    // Add DI change update notification
    log.info(`${PREFIX} generating change notifications`);
    const changeNotifications = updatedDeficiencies
      .map(deficientItem => {
        try {
          return configureNotifications.createDeficiencyUpdate(
            originalDeficiencyState,
            user,
            property,
            deficientItem
          );
        } catch (err) {
          log.error(
            `${PREFIX} failed to create change notification for deficiency: "${deficientItem.id}": ${err}`
          );
        }

        return null;
      })
      .filter(Boolean);
    notificationConfigs.push(...changeNotifications);

    // Add notification records to batch update
    for (let i = 0; i < notificationConfigs.length; i++) {
      const recordConfig = notificationConfigs[i];
      try {
        await notificationsModel.addRecord(
          db,
          recordConfig,
          notificationsBatch
        );
      } catch (err) {
        log.error(`${PREFIX} failed to add notification to batch: ${err}`);
      }
    }

    log.info(`${PREFIX} creating ${notificationConfigs.length} notifications`);

    // Commit all notifications in batched transaction
    try {
      await notificationsBatch.commit();
    } catch (err) {
      log.error(`${PREFIX} notification batch write failed: ${err}`);
    }
  };
};
