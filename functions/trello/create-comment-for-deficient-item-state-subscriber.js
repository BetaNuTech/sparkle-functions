const log = require('../utils/logger');
const config = require('../config');
const systemModel = require('../models/system');
const defItemModel = require('../models/deficient-items');
const usersModel = require('../models/users');
const findPreviousDIHistory = require('../deficient-items/utils/find-history');
const findAllTrelloCommentTemplates = require('../deficient-items/utils/find-all-trello-comment-templates')(
  config.deficientItems.trelloCommentTemplates
);

const PREFIX = 'trello: create-comment-for-deficient-item-state-subscriber:';
const INITIAL_DI_STATE = config.deficientItems.initialState;

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

    // Lookup DI current & historical states
    const findHistory = findPreviousDIHistory(deficientItem);
    const diStateHistory = findHistory('stateHistory');
    // const diDueDateHistory = findHistory('dueDates');
    const currentDiStateHistory = diStateHistory.current;
    const previousDiStateHistory = diStateHistory.previous;
    const previousDiState = previousDiStateHistory
      ? previousDiStateHistory.state
      : INITIAL_DI_STATE;
    // const currentDiDueDate = diDueDateHistory.current;
    // const previousDiDueDate = diDueDateHistory.previous;

    // Require one valid state history entry
    if (!isValidStateHistoryEntry(currentDiStateHistory)) {
      log.error(
        `${PREFIX} badly formed deficient item "stateHistory" entry | ${
          currentDiStateHistory
            ? JSON.stringify(currentDiStateHistory)
            : 'not found'
        }`
      );
      return; // eslint-disable-line no-useless-return
    }

    // Lookup 1st applicable comment templates
    // based on any previous state & current state
    const [commentTemplate] = findAllTrelloCommentTemplates(
      previousDiState,
      currentDiStateHistory.state
    );

    // Lookup user that created new DI State
    let stateAuthorsUser = null;
    const stateAuthorsUserId = currentDiStateHistory.user;
    try {
      const userSnap = await usersModel.getUser(db, stateAuthorsUserId);
      stateAuthorsUser = userSnap.val();
      if (!stateAuthorsUser) throw Error('user does not exist');
    } catch (err) {
      // Log and continue
      log.error(
        `${PREFIX} failed to find user: ${stateAuthorsUserId} | ${err}`
      );
    }
  });
};

/**
 * Is State History entry valid
 * @param  {Object}  stateHistoryEntry
 * @return {Boolean}
 */
function isValidStateHistoryEntry(stateHistoryEntry) {
  return (
    stateHistoryEntry &&
    typeof stateHistoryEntry === 'object' &&
    stateHistoryEntry.user &&
    typeof stateHistoryEntry.user === 'string' &&
    stateHistoryEntry.state &&
    typeof stateHistoryEntry.state === 'string'
  );
}
