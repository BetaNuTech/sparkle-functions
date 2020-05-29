const assert = require('assert');
const moment = require('moment-timezone');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const config = require('../../config');
const systemModel = require('../../models/system');
const defItemModel = require('../../models/deficient-items');
const usersModel = require('../../models/users');
const parseDiStateEventMsg = require('../utils/parse-di-state-event-msg');
const findPreviousDIHistory = require('../../deficient-items/utils/find-history');
const findAllTrelloCommentTemplates = require('../../deficient-items/utils/find-all-trello-comment-templates')(
  config.deficientItems.trelloCommentTemplates
);

const PREFIX = 'trello: pubsub: create-comment-for-deficient-item-state:';
const INITIAL_DI_STATE = config.deficientItems.initialState;
const RESPONSIBILITY_GROUPS = config.deficientItems.responsibilityGroups;
const DEFAULT_TIMEZONE = config.deficientItems.defaultTimezone;

/**
 * Append DI state updates as comments to previously created Trello cards
 * @param  {String} topic
 * @param  {functions.pubsub} pubsub
 * @param  {admin.database} db
 * @param  {admin.firestore} fs
 * @return {functions.cloudfunction}
 */
module.exports = function createCommentForDiState(topic = '', pubsub, db, fs) {
  assert(topic && typeof topic === 'string', 'has topic string');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

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
      `${PREFIX} ${topic} for DI: "${propertyId}/${deficientItemId}" and state "${deficientItemState}"`
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
        `${PREFIX} ${topic}: badly formed deficient item "stateHistory" entry | ${
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
        `${PREFIX} ${topic}: failed to find user "${stateAuthorsUserId}" | ${err}`
      );
    }

    const createCommentText = hbs.compile(commentTemplate);
    const commentData = cleanupFalsyHashAttrs({
      previousState: previousDiState.toUpperCase(),
      currentState: currentDiStateHistory.state.toUpperCase(),
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
        fs,
        propertyId,
        deficientItemId,
        trelloCardId,
        commentText
      );

      log.info(
        `${PREFIX} ${topic}: successfully appended Trello card status comment`
      );
    } catch (err) {
      // Wrap error
      throw Error(
        `${PREFIX} ${topic}: failed to Publish Trello comment | ${err}`
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

/**
 * Convert a UNIX UTC timestamp to
 * a "MM-DD-YYYY z" date string
 * @param  {Number|String} timestampSec
 * @param  {String?} timezone - default timezone name
 * @return {String}
 */
function unixToDateString(timestampSec, timezone = DEFAULT_TIMEZONE) {
  return moment(parseInt(timestampSec || 0, 10) * 1000)
    .tz(timezone)
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
