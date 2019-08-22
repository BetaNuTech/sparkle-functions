const log = require('../utils/logger');
const systemModel = require('../models/system');
const defItemModel = require('../models/deficient-item');
const findPreviousDIHistory = require('../deficient-items/utils/find-history');

const PREFIX = 'trello: create-comment-for-deficient-item-state-subscriber:';

/**
 * Append DI state updates as comments to previously created Trello cards
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createCommentForDiStateSubscriber(
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
      log.info(`${PREFIX} Deficient Item has no Trello Card, existing`);
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

    // Lookup previous DI histories
    const findHistory = findPreviousDIHistory(deficientItem);
    const previousDiState = findHistory('stateHistory').previous;


  });
};
