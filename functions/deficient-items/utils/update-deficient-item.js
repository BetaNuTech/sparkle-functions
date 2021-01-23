const assert = require('assert');
const pipe = require('../../utils/pipe');

/**
 *  Save a deficient item with updates
 *  relavant to its' target state
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @param  {Number?} createdAt
 * @param  {String?} progressNote
 * @param  {Object?} completedPhoto
 * @return {Object} - Deficient Item updates
 */
module.exports = function updateDeficientItem(
  deficientItem,
  changes,
  authorID = '',
  createdAt = Math.round(Date.now() / 1000),
  progressNote = '',
  completedPhoto
) {
  assert(
    deficientItem && typeof deficientItem === 'object',
    'has deficient item'
  );
  assert(changes && typeof changes === 'object', 'has changes object');

  return pipe(
    applyGoBackState,
    setPendingState,
    setWillRequireProgressNote,
    setIncompleteState,
    setCurrentDueDateDay,
    setCurrentStartDate,
    appendStateHistory,
    appendDueDate,
    setCurrentDeferredDateDay,
    appendDeferredDate,
    appendPlanToFix,
    appendCompleteNowReasons,
    appendResponsibilityGroup,
    appendReasonIncomplete,
    appendStartDate,
    appendProgressNote,
    appendCompletedPhoto,
    setUpdatedAt
  )({
    updates: Object.create(null),
    deficientItem: JSON.parse(JSON.stringify(deficientItem)),
    changes,
    authorID,
    createdAt,
    progressNote,
    completedPhoto,
  }).updates;
};

/**
 * Removed all current content on go back
 * @param  {Object} updates
 * @param  {Object} changes
 * @return {Object} - config
 */
function applyGoBackState(config) {
  const { updates, changes } = config;

  if (changes.state && changes.state[1] === 'go-back') {
    updates.currentPlanToFix = null;
    updates.currentReasonIncomplete = null;
    updates.currentDueDate = null;
    updates.currentDueDateDay = null;
    updates.currentDeferredDate = null;
    updates.currentDeferredDateDay = null;
    updates.currentResponsibilityGroup = null;
    updates.currentStartDate = null;
    updates.currentCompleteNowReason = null;
  }

  return config;
}

/**
 * Progress to pending state
 * when there are no direct state updates
 * other qualifications are met
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} progressNote
 * @return {Object} - config
 */
function setPendingState(config) {
  const { updates, deficientItem, changes, progressNote } = config;

  // Return early if state updated
  if (changes.state || updates.state) {
    return config;
  }

  let isPending = false;
  const currentState = deficientItem.state;

  if (currentState === 'requires-action' || currentState === 'go-back') {
    const {
      currentPlanToFix,
      currentResponsibilityGroup,
      currentDueDate,
    } = deficientItem;

    if (currentPlanToFix && currentResponsibilityGroup && currentDueDate) {
      updates.state = 'pending';
      isPending = true;
    }
  } else if (currentState === 'requires-progress-update' && progressNote) {
    updates.state = 'pending';
    isPending = true;
  }

  // Add change
  if (isPending) {
    changes.state = [currentState, 'pending'];
  }

  return config;
}

/**
 * Determine if DI will require
 * a progress note in its' next
 * state change
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} progressNote
 * @return {Object} - config
 */
function setWillRequireProgressNote(config) {
  const { updates, deficientItem, changes, progressNote } = config;
  const currentState = deficientItem.state;
  const isProgressingToPending =
    changes && changes.state && changes.state[1] === 'pending';

  if (
    (isProgressingToPending && currentState === 'requires-action') ||
    currentState === 'go-back'
  ) {
    let currentDueDate = new Date();
    let currentDueDateUnix = 0;

    // Lookup any relevant current due date
    // prioritizing current due date change
    // then reverting to DI's current due date
    if (changes.currentDueDate && changes.currentDueDate[1] instanceof Date) {
      currentDueDate = changes.currentDueDate[1];
    } else if (deficientItem.currentDueDate instanceof Date) {
      currentDueDate = deficientItem.currentDueDate;
    } else if (
      deficientItem.currentDueDate &&
      typeof deficientItem.currentDueDate === 'number'
    ) {
      currentDueDate = new Date(deficientItem.currentDueDate * 1000);
    }

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(currentDueDate.getHours());
    fiveDaysFromNow.setMinutes(currentDueDate.getMinutes());
    fiveDaysFromNow.setMilliseconds(currentDueDate.getMilliseconds());
    const fiveDaysFromNowUnix = toUnixTimestamp(fiveDaysFromNow);
    currentDueDateUnix = toUnixTimestamp(currentDueDate);

    if (currentDueDateUnix >= fiveDaysFromNowUnix) {
      updates.willRequireProgressNote = true;
    } else {
      updates.willRequireProgressNote = false;
    }
  }

  // Remove requirement for progress note
  // when adding progress note
  if (progressNote) {
    updates.willRequireProgressNote = false;
  }

  return config;
}

/**
 * Progress to incomplete state
 * when overdue and a new current reason
 * incomplete has been provided
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @return {Object} - config
 */
function setIncompleteState(config) {
  const { updates, deficientItem, changes } = config;

  // Return early if state updated
  if (changes.state || updates.state) {
    return config;
  }

  const currentState = deficientItem.state;
  const hasCurrentReasonIncomplete = Boolean(
    changes.currentReasonIncomplete ? changes.currentReasonIncomplete[1] : ''
  );

  if (currentState === 'overdue' && hasCurrentReasonIncomplete) {
    updates.state = 'incomplete';
    changes.state = [currentState, 'incomplete'];
  }

  return config;
}

/**
 * Set current due date day from
 * the updated date instance
 * @param  {Object} updates
 * @param  {Object} changes
 * @return {Object} - config
 */
function setCurrentDueDateDay(config) {
  const { updates, changes } = config;
  const updateDate = changes.currentDueDate ? changes.currentDueDate[1] : null;

  if (updateDate && updateDate instanceof Date) {
    const year = updateDate.getFullYear();
    const month = updateDate.getMonth() + 1;
    const day = updateDate.getDate();
    updates.currentDueDateDay = `${month < 10 ? '0' : ''}${month}/${
      day < 10 ? '0' : ''
    }${day}/${year}`;
  }

  return config;
}

/**
 * Set current start state when
 * DI becomes pending
 * @param  {Object} updates
 * @param  {Number} createdAt
 * @return {Object} - config
 */
function setCurrentStartDate(config) {
  const { updates, createdAt } = config;

  if (updates.state === 'pending') {
    updates.currentStartDate = createdAt;
  }

  return config;
}

/**
 * Add to state history when state
 * change is detected
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID,
 * @param  {Number} createdAt
 * @return {Object} - config
 */
function appendStateHistory(config) {
  const { updates, changes, authorID, createdAt } = config;
  const update = changes.state ? changes.state[1] : '';

  if (update && update !== changes.state[0]) {
    const id = uuid();

    updates.stateHistory = Object.create(null);
    updates.stateHistory[id] = {
      createdAt,
      state: update,
    };

    // Add optional user
    if (authorID) {
      updates.stateHistory[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add to due dates when current
 * due date gets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendDueDate(config) {
  const { updates, deficientItem, changes, authorID, createdAt } = config;
  const update = changes.currentDueDate ? changes.currentDueDate[1] : 0;
  const updateDay = changes.currentDueDateDay
    ? changes.currentDueDateDay[1]
    : updates.currentDueDateDay || '';

  if (update && update !== changes.currentDueDate[0]) {
    const id = uuid();

    updates.dueDates = Object.create(null);
    updates.dueDates[id] = {
      createdAt,
      dueDate: toUnixTimestamp(update),
      startDate: toUnixTimestamp(
        updates.currentStartDate || deficientItem.currentStartDate
      ),
    };

    // Add optional due date day
    if (updateDay) {
      updates.dueDates[id].dueDateDay = updateDay;
    }

    // Add optional user
    if (authorID) {
      updates.dueDates[id].user = authorID;
    }
  }

  return config;
}

/**
 * Set current due date day from
 * the updated date instance
 * @param  {Object} updates
 * @param  {Object} changes
 * @return {Object} - config
 */
function setCurrentDeferredDateDay(config) {
  const { updates, changes } = config;
  const updateDate = changes.currentDeferredDate
    ? changes.currentDeferredDate[1]
    : null;

  if (updateDate && updateDate instanceof Date) {
    const year = updateDate.getFullYear();
    const month = updateDate.getMonth() + 1;
    const day = updateDate.getDate();
    updates.currentDeferredDateDay = `${month < 10 ? '0' : ''}${month}/${
      day < 10 ? '0' : ''
    }${day}/${year}`;
  }

  return config;
}

/**
 * Add to due dates when current
 * due date gets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendDeferredDate(config) {
  const { updates, changes, authorID, createdAt } = config;
  const update = changes.currentDeferredDate
    ? changes.currentDeferredDate[1]
    : 0;
  const updateDay = changes.currentDeferredDateDay
    ? changes.currentDeferredDateDay[1]
    : updates.currentDeferredDateDay || '';

  if (update && update !== changes.currentDeferredDate[0]) {
    const id = uuid();

    updates.deferredDates = Object.create(null);
    updates.deferredDates[id] = {
      createdAt,
      deferredDate: toUnixTimestamp(update),
    };

    // Add optional deferred day
    if (updateDay) {
      updates.deferredDates[id].deferredDateDay = updateDay;
    }

    // Add optional user
    if (authorID) {
      updates.deferredDates[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add to plans to fix when current
 * plan to fix gets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendPlanToFix(config) {
  const { updates, deficientItem, changes, authorID, createdAt } = config;
  const update = changes.currentPlanToFix ? changes.currentPlanToFix[1] : '';

  if (update && update !== changes.currentPlanToFix[0]) {
    const id = uuid();

    updates.plansToFix = Object.create(null);
    updates.plansToFix[id] = {
      createdAt,
      planToFix: update,
      startDate: toUnixTimestamp(
        updates.currentStartDate || deficientItem.currentStartDate
      ),
    };

    // Add optional user
    if (authorID) {
      updates.plansToFix[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add to complete now reasons
 * when current complete now gets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendCompleteNowReasons(config) {
  const { updates, changes, authorID, createdAt } = config;
  const update = changes.currentCompleteNowReason
    ? changes.currentCompleteNowReason[1]
    : '';

  if (update && update !== changes.currentCompleteNowReason[0]) {
    const id = uuid();

    updates.completeNowReasons = Object.create(null);
    updates.completeNowReasons[id] = {
      createdAt,
      completeNowReason: update,
    };

    // Add optional user
    if (authorID) {
      updates.completeNowReasons[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add responsibility to history when
 * current responsibility group gets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendResponsibilityGroup(config) {
  const { updates, deficientItem, changes, authorID, createdAt } = config;
  const update = changes.currentResponsibilityGroup
    ? changes.currentResponsibilityGroup[1]
    : 0;

  if (update && update !== changes.currentResponsibilityGroup[0]) {
    const id = uuid();

    updates.responsibilityGroups = Object.create(null);
    updates.responsibilityGroups[id] = {
      createdAt,
      groupResponsible: update,
      startDate: toUnixTimestamp(
        updates.currentStartDate || deficientItem.currentStartDate
      ),
    };

    // Add optional user
    if (authorID) {
      updates.responsibilityGroups[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add reason incomplete to history when
 * current reason incomplete gets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendReasonIncomplete(config) {
  const { updates, deficientItem, changes, authorID, createdAt } = config;
  const update = changes.currentReasonIncomplete
    ? changes.currentReasonIncomplete[1]
    : 0;

  if (update && update !== changes.currentReasonIncomplete[0]) {
    const id = uuid();

    updates.reasonsIncomplete = Object.create(null);
    updates.reasonsIncomplete[id] = {
      createdAt,
      reasonIncomplete: update,
      startDate: toUnixTimestamp(
        updates.currentStartDate || deficientItem.currentStartDate
      ),
    };

    // Add optional user
    if (authorID) {
      updates.reasonsIncomplete[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add new start date to history
 * when current start dategets updated
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @return {Object} - config
 */
function appendStartDate(config) {
  const { updates, changes } = config;
  const original = changes.currentStartDate ? changes.currentStartDate[0] : 0;
  const update = changes.currentStartDate
    ? changes.currentStartDate[1]
    : updates.currentStartDate || 0;

  if (update && update !== original) {
    updates.startDates = Object.create(null);
    updates.startDates[uuid()] = { startDate: toUnixTimestamp(update) };
  }

  return config;
}

/**
 * Add optional progress note to history
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @param  {Number} createdAt
 * @param  {String?} progressNote
 * @return {Object} - config
 */
function appendProgressNote(config) {
  const { updates, deficientItem, authorID, createdAt, progressNote } = config;

  if (progressNote) {
    const id = uuid();

    updates.progressNotes = Object.create(null);
    updates.progressNotes[id] = {
      createdAt,
      progressNote,
      startDate: toUnixTimestamp(
        updates.currentStartDate || deficientItem.currentStartDate
      ),
    };

    // Add optional user
    if (authorID) {
      updates.progressNotes[id].user = authorID;
    }
  }

  return config;
}

/**
 * Add an optional completed photo to DI's
 * `completedPhotos` configuration
 * @param  {Object} updates
 * @param  {Object} completedPhoto
 * @return {Object} - config
 */
function appendCompletedPhoto(config) {
  const { updates, completedPhoto } = config;

  if (completedPhoto) {
    updates.completedPhotos = updates.completedPhotos || Object.create(null);
    Object.assign(updates.completedPhotos, completedPhoto); // append photo JSON
  }

  return config;
}

/**
 * Set updated at if there's any updates
 * @param  {Object} changes
 * @param  {Number} createdAt
 * @return {Object} - config
 */
function setUpdatedAt(config) {
  const { updates, changes, createdAt, progressNote } = config;

  if (Object.keys(changes).length || progressNote) {
    updates.updatedAt = createdAt;
  }

  return config;
}

/**
 * Convert any value to a UNIX timestamp
 * @param  {Any} dateOrTimestamp
 * @return {Number}
 */
function toUnixTimestamp(dateOrTimestamp) {
  if (dateOrTimestamp instanceof Date) {
    return dateOrTimestamp.getTime() / 1000; // is date
  }
  if (dateOrTimestamp) {
    return dateOrTimestamp; // already number
  }
  return 0; // force numberic
}

/**
 * Generate a short length id
 * @param  {Number} len
 * @return {String}
 */
function uuid(len = 20) {
  if (typeof len !== 'number' || len !== len || len < 1) {
    throw Error('utils: uuid: invalid length argument');
  }
  return [...Array(len)]
    .map(() => 'x')
    .join('')
    .replace(/[x]/g, generateChar);
}

/**
 * Generate a random charater
 * @param  {String} c
 * @return {String}
 */
function generateChar(c) {
  const r = (Math.random() * 16) | 0; // eslint-disable-line
  const v = c === 'x' ? r : (r & 0x3) | 0x8; // eslint-disable-line
  return v.toString(16);
}
