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
    } catch (err) {
      const msgErr = `${PREFIX} message error: ${err}`;
      log.error(msgErr);
      throw Error(msgErr);
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
    const findHistory = findPreviousDIHistory(deficientItem);
    const diDueDateHistory = findHistory('dueDates');
    const currDiDueDate = diDueDateHistory.current;

    // PUT default Trello Due Date
    if (currDiDueDate && deficientItem.updatedAt === currDiDueDate.createdAt) {
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
    // TODO otherwise use current deferred date
  });
};
