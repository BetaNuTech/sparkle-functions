const log = require('../utils/logger');
const systemModel = require('../models/system');
const parseDiStateEventMsg = require('./utils/parse-di-state-event-msg');

const PREFIX = 'trello: close-deficient-item-card-subscriber:';
const PROCESS_DI_STATES = ['closed', 'completed'];

/**
 * Move closed/completed DI Card to closed list
 * and remove any due date on the Trello card
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function closeDiCardSubscriber(topic = '', pubsub, db) {
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
      const msgErr = `${PREFIX} ${topic} message error: ${err}`;
      log.error(msgErr);
      throw Error(msgErr);
    }

    // Ignore events for non-closed/uncompleted DI's
    if (!PROCESS_DI_STATES.includes(deficientItemState)) {
      return;
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

    // Close any Trello card for DI
    let trelloCardResponse = null;
    if (deficientItemState === 'closed') {
      try {
        trelloCardResponse = await systemModel.closeDeficientItemsTrelloCard(
          db,
          propertyId,
          deficientItemId
        );
        if (trelloCardResponse)
          log.info(`${PREFIX} successfully closed Trello card`);
      } catch (err) {
        log.error(
          `${PREFIX} Failed request to close DI Trello card status: "${err.status ||
            'N/A'}" | message: "${err.body ? err.body.message : err}"`
        );
      }
    }
  });
};
