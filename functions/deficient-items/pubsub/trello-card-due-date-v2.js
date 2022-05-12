const assert = require('assert');
const log = require('../../utils/logger');
const toISO8601 = require('../../trello/utils/date-to-iso-8601');
const parseDiStateEventMsg = require('../../trello/utils/parse-di-state-event-msg');
const findPreviousDIHistory = require('../../deficient-items/utils/find-history');
const trello = require('../../services/trello');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const propertiesModel = require('../../models/properties');

const PREFIX = 'deficiency: pubsub: trello-card-due-date-v2:';

/**
 * Update due dates of previously created
 * Trello cards of deficiencies
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {string} topic
 * @return {functions.cloudfunction}
 */
module.exports = function createTrelloDueDate(db, pubsub, topic) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has topic string');

  return pubsub.topic(topic).onPublish(async message => {
    let propertyId = '';
    let deficiencyId = '';
    let deficiencyState = '';

    // Parse event message
    try {
      [propertyId, deficiencyId, deficiencyState] = parseDiStateEventMsg(
        message
      );
    } catch (err) {
      // Wrap error
      throw Error(`${PREFIX} failed to parse pubsub message | ${err}`);
    }

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficiencyId
      );
    } catch (err) {
      // Wrap error
      throw Error(
        `${PREFIX} system property trello card id lookup failed  | ${err}`
      );
    }

    // Lookup Trello credentials
    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.findTrello(db);
      trelloCredentials = trelloCredentialsSnap.data();
      if (!trelloCredentials) {
        throw Error('Organization has not authorized Trello');
      }
    } catch (err) {
      log.warn(`${PREFIX} trello credentials not found | ${err}`); // wrap error
      return;
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficiency has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data();
    } catch (err) {
      throw Error(`${PREFIX} property lookup failed | ${err}`);
    }

    if (!property) {
      log.error(`${PREFIX} bad property reference: "${propertyId}"`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup Deficient Item
    let deficiency = null;
    try {
      const deficiencySnap = await deficiencyModel.findRecord(db, deficiencyId);
      deficiency = deficiencySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} deficiency lookup failed | ${err}`);
    }

    if (!deficiency) {
      log.error(`${PREFIX} bad deficiency reference: "${deficiencyId}"`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup DI historical states
    const { updatedAt } = deficiency;
    const findHistory = findPreviousDIHistory(deficiency);
    const diDueDateHistory = findHistory('dueDates');
    const diDeferDateHistory = findHistory('deferredDates');
    const diStateHistory = findHistory('stateHistory');
    const currDiDueDate = diDueDateHistory.current;
    const currDeferDate = diDeferDateHistory.current;
    const currStateHist = diStateHistory.current;
    let trelloApiErr = null;

    if (
      deficiencyState === 'deferred' &&
      currDeferDate &&
      updatedAt === currDeferDate.createdAt &&
      deficiency.currentDeferredDateDay
    ) {
      // PUT deferred as Trello card Due Date
      try {
        await trello.updateTrelloCard(
          trelloCardId,
          trelloCredentials.authToken,
          trelloCredentials.apikey,
          {
            due: toISO8601(deficiency.currentDeferredDateDay, property.zip),
            dueComplete: false,
          }
        );

        log.info(
          `${PREFIX} successfully updated Trello card due date to deferred date`
        );
      } catch (err) {
        log.error(
          `${PREFIX} failed to update Trello card due date to deferred date | ${err}`
        );
        trelloApiErr = err;
      }
    } else if (
      currDiDueDate &&
      updatedAt === currDiDueDate.createdAt &&
      deficiency.currentDueDateDay
    ) {
      // PUT due date as Trello card Due Date
      try {
        await trello.updateTrelloCard(
          trelloCardId,
          trelloCredentials.authToken,
          trelloCredentials.apikey,
          {
            due: toISO8601(deficiency.currentDueDateDay, property.zip),
            dueComplete: false,
          }
        );

        log.info(`${PREFIX} successfully updated Trello card due date`);
      } catch (err) {
        // Wrap error
        log.error(`${PREFIX} failed to update Trello card due date | ${err}`);
        trelloApiErr = err;
      }
    } else if (
      currStateHist.state === 'go-back' &&
      updatedAt === currStateHist.createdAt
    ) {
      // PUT remove any due date and completed label
      try {
        await trello.updateTrelloCard(
          trelloCardId,
          trelloCredentials.authToken,
          trelloCredentials.apikey,
          { due: null, dueComplete: false }
        );

        log.info(
          `${PREFIX} successfully removed Trello card due date/completion label`
        );
      } catch (err) {
        log.error(
          `${PREFIX} failed to update Trello card due date/completion label | ${err}`
        );
        trelloApiErr = err;
      }
    }

    // Cleanup deleted Trello card references
    if (trelloApiErr && trelloApiErr.code === 'ERR_TRELLO_CARD_DELETED') {
      try {
        await systemModel.cleanupDeletedTrelloCard(
          db,
          deficiencyId,
          trelloCardId
        );
        return;
      } catch (cleanUpErr) {
        throw Error(
          `${PREFIX} failed to cleanup deleted Trello Card | ${cleanUpErr}`
        );
      }
    }
  });
};
