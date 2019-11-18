const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const defItemModel = require('../../models/deficient-items');
const toISO8601 = require('../utils/date-to-iso-8601');
const parseDiStateEventMsg = require('../utils/parse-di-state-event-msg');
const findPreviousDIHistory = require('../../deficient-items/utils/find-history');
const propertiesModel = require('../../models/properties');

const PREFIX = 'trello: pubsub: update-update-card-due-date:';

/**
 * Update due dates of previously created Trello cards
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createUpdateDueDate(topic = '', pubsub, db) {
  return pubsub.topic(topic).onPublish(async message => {
    let propertyId = '';
    let deficientItemId = '';
    let deficientItemState = '';

    // Parse event message
    try {
      [propertyId, deficientItemId, deficientItemState] = parseDiStateEventMsg(
        message
      );
    } catch (err) {
      // Wrap error
      throw Error(`${PREFIX} ${topic} | ${err}`);
    }

    log.info(
      `${PREFIX} ${topic}: for DI "${propertyId}/${deficientItemId}" and state "${deficientItemState}"`
    );

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.val();
      if (!property) throw Error('Not found');
    } catch (err) {
      throw Error(`${PREFIX} property lookup failed | ${err}`);
    }

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficientItemId
      );
    } catch (err) {
      // Wrap error
      throw Error(`${PREFIX} ${topic} | ${err}`);
    }

    if (!trelloCardId) {
      log.info(
        `${PREFIX} ${topic}: Deficient Item has no Trello Card, exiting`
      );
      return; // eslint-disable-line no-useless-return
    }

    // Lookup Deficient Item
    let deficientItem = null;
    try {
      const deficientItemSnap = await defItemModel.find(
        db,
        propertyId,
        deficientItemId
      );
      deficientItem = deficientItemSnap.val();
    } catch (err) {
      log.error(`${PREFIX} ${topic} | ${err}`);
    }

    if (!deficientItem) {
      log.error(`${PREFIX} ${topic}: bad deficient item reference`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup DI historical states
    const { updatedAt } = deficientItem;
    const findHistory = findPreviousDIHistory(deficientItem);
    const diDueDateHistory = findHistory('dueDates');
    const diDeferDateHistory = findHistory('deferredDates');
    const diStateHistory = findHistory('stateHistory');
    const currDiDueDate = diDueDateHistory.current;
    const currDeferDate = diDeferDateHistory.current;
    const currStateHist = diStateHistory.current;

    if (
      deficientItemState === 'deferred' &&
      currDeferDate &&
      updatedAt === currDeferDate.createdAt &&
      deficientItem.currentDeferredDateDay
    ) {
      // PUT deferred as Trello card Due Date
      try {
        await systemModel.updateTrelloCard(
          db,
          propertyId,
          deficientItemId,
          trelloCardId,
          {
            due: toISO8601(deficientItem.currentDeferredDateDay, property.zip),
            dueComplete: false,
          }
        );

        log.info(
          `${PREFIX} ${topic}: successfully updated Trello card due date to deferred date`
        );
      } catch (err) {
        // Wrap error
        throw Error(
          `${PREFIX} ${topic}: failed to update Trello card due date to deferred date | ${err}`
        );
      }
    } else if (
      currDiDueDate &&
      updatedAt === currDiDueDate.createdAt &&
      deficientItem.currentDueDateDay
    ) {
      // PUT due date as Trello card Due Date
      try {
        await systemModel.updateTrelloCard(
          db,
          propertyId,
          deficientItemId,
          trelloCardId,
          {
            due: toISO8601(deficientItem.currentDueDateDay, property.zip),
            dueComplete: false,
          }
        );

        log.info(
          `${PREFIX} ${topic}: successfully updated Trello card due date`
        );
      } catch (err) {
        // Wrap error
        throw Error(
          `${PREFIX} ${topic}: failed to update Trello card due date | ${err}`
        );
      }
    } else if (
      currStateHist.state === 'go-back' &&
      updatedAt === currStateHist.createdAt
    ) {
      // PUT remove any due date and completed label
      try {
        await systemModel.updateTrelloCard(
          db,
          propertyId,
          deficientItemId,
          trelloCardId,
          { due: null, dueComplete: false }
        );

        log.info(
          `${PREFIX} ${topic}: successfully removed Trello card due date/completion label`
        );
      } catch (err) {
        // Wrap error
        throw Error(
          `${PREFIX} ${topic}: failed to update Trello card due date/completion label | ${err}`
        );
      }
    }
  });
};
