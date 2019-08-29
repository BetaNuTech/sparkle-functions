const moment = require('moment');
const log = require('../utils/logger');
const systemModel = require('../models/system');
const defItemModel = require('../models/deficient-items');
const toISO8601 = require('./utils/date-to-iso-8601');
const findPreviousDIHistory = require('../deficient-items/utils/find-history');

const PREFIX = 'trello: update-update-card-due-date-subscriber:';

/**
 * Update due dates of previously created Trello cards
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createUpdateDueDateSubscriber(
  topic = '',
  pubsub,
  db
) {
  return pubsub.topic(topic).onPublish(async message => {
    let propertyId = '';
    let deficientItemId = '';
    let deficientItemState = '';

    // Parse event message
    try {
      const path = message.data
        ? Buffer.from(message.data, 'base64').toString()
        : '';

      if (!path) {
        throw new Error(`topic: ${topic} received invalid message`);
      }

      [propertyId, deficientItemId, , deficientItemState] = path.split('/');
      if (!propertyId || !deficientItemId || !deficientItemState)
        throw Error('Badly formed message');
    } catch (err) {
      log.error(`${PREFIX} failed parsing ${topic} message`);
      throw err;
    }

    log.info(
      `${PREFIX} received ${parseInt(
        Date.now() / 1000,
        10
      )} for DI: ${propertyId}/${deficientItemId} | state: ${deficientItemState}`
    );

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficientItemId
      );
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
      throw err;
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficient Item has no Trello Card, exiting`);
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
      log.error(`${PREFIX} | ${err}`);
    }

    if (!deficientItem) {
      log.error(`${PREFIX} bad deficient item reference`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup DI historical states
    const { updatedAt } = deficientItem;
    const findHistory = findPreviousDIHistory(deficientItem);
    const diDueDateHistory = findHistory('dueDates');
    const diDeferDateHistory = findHistory('deferredDates');
    const currDiDueDate = diDueDateHistory.current;
    const currDeferDate = diDeferDateHistory.current;

    if (
      deficientItemState === 'deferred' &&
      currDeferDate &&
      currDeferDate.deferredDate &&
      updatedAt === currDeferDate.createdAt
    ) {
      // PUT deferred as Trello card Due Date
      try {
        await systemModel.putTrelloCardDueDate(
          db,
          propertyId,
          deficientItemId,
          trelloCardId,
          toISO8601(getCurrentDueDay(currDeferDate.deferredDate))
        );

        log.info(
          `${PREFIX} successfully updated Trello card due date to deferred date`
        );
      } catch (err) {
        log.error(
          `${PREFIX} failed to update Trello card due date to deferred date`
        );
        throw err;
      }
    } else if (currDiDueDate && updatedAt === currDiDueDate.createdAt) {
      // PUT due date as Trello card Due Date
      try {
        await systemModel.putTrelloCardDueDate(
          db,
          propertyId,
          deficientItemId,
          trelloCardId,
          toISO8601(deficientItem.currentDueDateDay)
        );

        log.info(`${PREFIX} successfully updated Trello card due date`);
      } catch (err) {
        log.error(`${PREFIX} failed to update Trello card due date`);
        throw err;
      }
    }
  });
};

/**
 * Convert a UNIX timestamp to at
 * `MM/DD/YYYY` UTC datestring
 * @param  {Number} timestampSec
 * @return {String}
 */
function getCurrentDueDay(timestampSec) {
  return moment
    .utc(parseInt(timestampSec || 0, 10) * 1000)
    .format('MM/DD/YYYY');
}
