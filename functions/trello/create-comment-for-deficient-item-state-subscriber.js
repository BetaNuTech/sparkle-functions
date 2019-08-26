const moment = require('moment');
const log = require('../utils/logger');
const templateParser = require('../utils/interpolate-template');
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
const RESPONSIBILITY_GROUPS = config.deficientItems.responsibilityGroups;
const UTC_TZ_OFFSET = '-05:00'; // EST

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
    const diDueDateHistory = findHistory('dueDates');
    const diDeferDateHistory = findHistory('deferredDates');
    const diProgNoteHistory = findHistory('progressNotes');
    const currentDiStateHistory = diStateHistory.current;
    const previousDiStateHistory = diStateHistory.previous;
    const previousDiState = previousDiStateHistory
      ? previousDiStateHistory.state
      : INITIAL_DI_STATE;
    const currentResponsibilityGroup =
      RESPONSIBILITY_GROUPS[deficientItem.currentResponsibilityGroup] || '';
    const currentProgNote = diProgNoteHistory.current
      ? diProgNoteHistory.current.progressNote
      : '';
    const currDiDueDate = diDueDateHistory.current;
    let prevDiDueDate = diDueDateHistory.previous;
    let currDiDeferDate = diDeferDateHistory.current;

    // Format UNIX values as date strings
    if (prevDiDueDate) prevDiDueDate = unixToDateString(prevDiDueDate.dueDate);
    if (currDiDeferDate) {
      currDiDeferDate = unixToDateString(currDiDeferDate.deferredDate);
    }

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

    const createCommentText = templateParser(commentTemplate);
    const commentData = cleanupFalsyHashAttrs({
      previousState: previousDiState,
      currentState: currentDiStateHistory.state,
      firstName: stateAuthorsUser.firstName,
      lastName: stateAuthorsUser.lastName,
      email: stateAuthorsUser.email,
      currentDueDateDay: deficientItem.currentDueDateDay,
      previousDueDateDay: prevDiDueDate,
      currentDeferredDateDay: currDiDeferDate,
      currentResponsibilityGroup,
      currentPlanToFix: deficientItem.currentPlanToFix,
      currentProgressNote: currentProgNote,
      currentReasonIncomplete: deficientItem.currentReasonIncomplete,
    });

    // POST comment to Trello Card
    try {
      const commentText = createCommentText(commentData);
      await systemModel.postTrelloCardComment(
        db,
        propertyId,
        deficientItemId,
        trelloCardId,
        commentText
      );

      log.info(`${PREFIX} successfully appended Trello card status comment`);
    } catch (err) {
      log.error(`${PREFIX} failed to Publish Trello comment`);
      throw err;
    }

    // PUT Trello Due Date
    if (currDiDueDate && deficientItem.updatedAt === currDiDueDate.createdAt) {
      try {
        await systemModel.putTrelloCardDueDate(
          db,
          propertyId,
          deficientItemId,
          trelloCardId,
          deficientItem.currentDueDateDay
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

/**
 * Convert a UNIX UTC timestamp to
 * a "MM-DD-YYYY z" date string
 * @param  {Number|String} timestampSec
 * @param  {String?} - utc offset
 * @return {String}
 */
function unixToDateString(timestampSec, utcOffset = UTC_TZ_OFFSET) {
  return moment
    .unix(parseInt(timestampSec || 0, 10))
    .utcOffset(utcOffset)
    .format('MM-DD-YYYY z');
}

/**
 * Remove top falsey attributes from
 * an object
 * @param  {Object} hash
 * @return {Object}
 */
function cleanupFalsyHashAttrs(hash) {
  const result = JSON.parse(JSON.stringify(hash));

  Object.keys(result).forEach(attr => {
    if (!result[attr]) {
      delete result[attr];
    }
  });

  return result;
}
