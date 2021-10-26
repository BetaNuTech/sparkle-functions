const assert = require('assert');
const moment = require('moment-timezone');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const config = require('../../config');
const trello = require('../../services/trello');
const usersModel = require('../../models/users');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const parseDiStateEventMsg = require('../../trello/utils/parse-di-state-event-msg');
const findPreviousDIHistory = require('../../deficient-items/utils/find-history');
const findAllTrelloCommentTemplates = require('../../deficient-items/utils/find-all-trello-comment-templates')(
  config.deficientItems.trelloCommentTemplates
);

const PREFIX = 'trello: pubsub: deficiency-trello-card-state-comment-v2:';
const INITIAL_DI_STATE = config.deficientItems.initialState;
const RESPONSIBILITY_GROUPS = config.deficientItems.responsibilityGroups;
const DEFAULT_TIMEZONE = config.deficientItems.defaultTimezone;

/**
 * Append Deficiency state updates as comments
 * to its' previously created Trello card
 * @param  {admin.firestore} fs
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @return {functions.cloudfunction}
 */
module.exports = function createTrelloCardStateCommentV2(fs, pubsub, topic) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
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

    log.info(
      `${PREFIX} deficiency: "${deficiencyId}" state became: "${deficiencyState}"`
    );

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        fs,
        propertyId,
        deficiencyId
      );
    } catch (err) {
      // Wrap error
      throw Error(
        `${PREFIX} system property trello card id lookup failed  | ${err}`
      );
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} deficiency has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup Trello credentials
    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.findTrello(fs);
      trelloCredentials = trelloCredentialsSnap.data();
      if (!trelloCredentials) {
        throw Error('Organization has not authorized Trello');
      }
    } catch (err) {
      log.warn(`${PREFIX} trello credentials not found | ${err}`); // wrap error
      return;
    }

    // Lookup Deficiency
    let deficiency = null;
    try {
      const deficiencySnap = await deficiencyModel.findRecord(fs, deficiencyId);
      deficiency = deficiencySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} deficiency lookup failed | ${err}`);
    }

    if (!deficiency) {
      log.error(`${PREFIX} bad deficiency reference: "${deficiencyId}"`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup DI current & historical states
    const findHistory = findPreviousDIHistory(deficiency);
    const defStateHistory = findHistory('stateHistory');
    const defDueDateHistory = findHistory('dueDates');
    const defDeferDateHistory = findHistory('deferredDates');
    const defProgNoteHistory = findHistory('progressNotes');
    const currentDefStateHistory = defStateHistory.current;
    const previousDefStateHistory = defStateHistory.previous;
    const previousDefState = previousDefStateHistory
      ? previousDefStateHistory.state
      : INITIAL_DI_STATE;
    const currentResponsibilityGroup =
      RESPONSIBILITY_GROUPS[deficiency.currentResponsibilityGroup] || '';
    const currentProgNote = defProgNoteHistory.current
      ? defProgNoteHistory.current.progressNote
      : '';
    let prevDiDueDate = defDueDateHistory.previous;
    let currDiDeferDate = defDeferDateHistory.current;

    // Format UNIX values as date strings
    if (prevDiDueDate) prevDiDueDate = unixToDateString(prevDiDueDate.dueDate);
    if (currDiDeferDate) {
      currDiDeferDate = unixToDateString(currDiDeferDate.deferredDate);
    }

    // Require one valid state history entry
    if (!isValidStateHistoryEntry(currentDefStateHistory)) {
      log.error(
        `${PREFIX} ${topic}: badly formed deficient item "stateHistory" entry | ${
          currentDefStateHistory
            ? JSON.stringify(currentDefStateHistory)
            : 'not found'
        }`
      );
      return; // eslint-disable-line no-useless-return
    }

    // Lookup 1st applicable comment templates
    // based on any previous state & current state
    const [commentTemplate] = findAllTrelloCommentTemplates(
      previousDefState,
      currentDefStateHistory.state
    );

    // Lookup user that created new deficiency State
    let stateAuthorsUser = null;
    const stateAuthorsUserId = currentDefStateHistory.user;
    try {
      const userSnap = await usersModel.findRecord(fs, stateAuthorsUserId);
      stateAuthorsUser = userSnap.data();
      if (!stateAuthorsUser) throw Error('user does not exist');
    } catch (err) {
      // Log and continue
      log.error(
        `${PREFIX} ${topic}: failed to find user "${stateAuthorsUserId}" | ${err}`
      );
    }

    const createCommentText = hbs.compile(commentTemplate);
    const commentData = cleanupFalsyHashAttrs({
      previousState: previousDefState.toUpperCase(),
      currentState: currentDefStateHistory.state.toUpperCase(),
      firstName: stateAuthorsUser.firstName,
      lastName: stateAuthorsUser.lastName,
      email: stateAuthorsUser.email,
      currentDueDateDay: deficiency.currentDueDateDay,
      previousDueDateDay: prevDiDueDate,
      currentDeferredDateDay: currDiDeferDate,
      currentResponsibilityGroup,
      currentPlanToFix: deficiency.currentPlanToFix,
      currentProgressNote: currentProgNote,
      currentReasonIncomplete: deficiency.currentReasonIncomplete,
    });

    // Publish comment to Trello Card
    try {
      const commentText = createCommentText(commentData);
      await trello.publishTrelloCardComment(
        trelloCardId,
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        commentText
      );

      log.info(
        `${PREFIX} successfully published deficiency state comment to Trello card`
      );
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        try {
          await systemModel.cleanupDeletedTrelloCard(
            fs,
            deficiencyId,
            trelloCardId
          );
          return;
        } catch (cleanUpErr) {
          throw Error(
            `${PREFIX} failed to cleanup deleted Trello Card | ${cleanUpErr}`
          );
        }
      } else {
        throw Error(`${PREFIX} failed to Publish Trello comment | ${err}`);
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
