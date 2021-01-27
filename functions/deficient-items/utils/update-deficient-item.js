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
 * @return {Object?} - Deficient Item updates
 */
module.exports = function updateDeficientItem(
  deficientItem,
  changes,
  authorID = '',
  createdAt = Math.round(Date.now() / 1000),
  progressNote = '',
  completedPhoto = null
) {
  assert(
    deficientItem && typeof deficientItem === 'object',
    'has deficient item'
  );
  assert(changes && typeof changes === 'object', 'has changes object');

  return pipe(
    setPendingState,
    setDeferredState,
    setIncompleteState,
    setGoBackState,
    setClosedState,
    // TODO: setOverdueState,
    setRequiresProgressUpdateState,
    setWillRequireProgressNote,
    applyGoBackStateSideEffects,
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
    setCompletedState, // NOTE: must be after appendCompletedPhoto
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
function applyGoBackStateSideEffects(config) {
  const { updates } = config;
  const isProgressingToGoBack = updates.state === 'go-back';

  if (isProgressingToGoBack) {
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
  const isRequestingPending = changes.state === 'pending';

  // Return early if state already updated
  // or pending state change not requested
  if (updates.state || !isRequestingPending) {
    return config;
  }

  const currentState = deficientItem.state;
  const currentStartDate = deficientItem.currentStartDate || 0;
  const isValidCurrentState = ['requires-action', 'go-back'].includes(
    currentState
  );
  const isValidProgNoteState = currentState === 'requires-progress-update';
  const hasRequiredNoteUpdate =
    Boolean(progressNote) ||
    hasCurrentStartDate(currentStartDate, deficientItem.progressNotes || {});

  if (isValidCurrentState) {
    const currentPlanToFix =
      deficientItem.currentPlanToFix || changes.currentPlanToFix;
    const currentResponsibilityGroup =
      deficientItem.currentResponsibilityGroup ||
      changes.currentResponsibilityGroup;
    const currentDueDate =
      changes.currentDueDate || deficientItem.currentDueDate || 0;

    // 23 hours provides buffer for user to
    // send an update w/ minimum date of 24
    // hours from now
    const hasValidDueDate = isAfter23HoursFromNow(currentDueDate);

    if (currentPlanToFix && currentResponsibilityGroup && hasValidDueDate) {
      updates.state = 'pending';
    }
  } else if (isValidProgNoteState && hasRequiredNoteUpdate) {
    updates.state = 'pending';
  }

  return config;
}

/**
 * Progress to deferred state
 * when provided a valid deferred date
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @return {Object} - config
 */
function setDeferredState(config) {
  const { updates, deficientItem, changes } = config;
  const isRequestingDefer = changes.state === 'deferred';

  // Return early if state already updated
  // or not requesting deferred state change
  if (updates.state || !isRequestingDefer) {
    return config;
  }

  const isValidCurrentState = [
    'requires-action',
    'go-back',
    'pending',
  ].includes(deficientItem.state);
  const deferredDate =
    changes.currentDeferredDate || deficientItem.currentDeferredDate || 0;

  // 23 hours provides buffer for user to
  // send an update w/ minimum date of 24
  // hours from now
  const hasValidDeferredDate = isAfter23HoursFromNow(deferredDate);

  if (isRequestingDefer && isValidCurrentState && hasValidDeferredDate) {
    updates.state = 'deferred';
  }

  return config;
}

/**
 * Set new state to go-back
 * @param {Object} updates
 * @param {Object} deficientItem
 * @param {Object} changes
 * @return {Object} - config
 */
function setGoBackState(config) {
  const { updates, deficientItem, changes } = config;
  const isRequestingGoBack = changes.state === 'go-back';

  // Return early if state already updated
  // or not requesting go back state change
  if (updates.state || !isRequestingGoBack) {
    return config;
  }

  const currentState = deficientItem.state;
  const isValidCurrentState = ['deferred', 'incomplete', 'completed'].includes(
    currentState
  );

  if (isValidCurrentState) {
    updates.state = 'go-back';
  }

  return config;
}

/**
 * Set new state to closed
 * @param {Object} updates
 * @param {Object} deficientItem
 * @param {Object} changes
 * @return {Object} - config
 */
function setClosedState(config) {
  const { updates, deficientItem, changes } = config;
  const isRequestingClosed = changes.state === 'closed';

  // Return early if state already updated
  // or not requesting closed state change
  if (updates.state || !isRequestingClosed) {
    return config;
  }

  const currentState = deficientItem.state;
  const isValidCurrentState = [
    'requires-action',
    'incomplete',
    'deferred',
    'completed',
  ].includes(currentState);

  if (isValidCurrentState) {
    updates.state = 'closed';
  }

  return config;
}

/**
 * Set new state to requires progress update
 * @param {Object} updates
 * @param {Object} deficientItem
 * @param {Object} changes
 * @return {Object} - config
 */
function setRequiresProgressUpdateState(config) {
  const { updates, deficientItem, changes } = config;
  const isRequestingClosed = changes.state === 'requires-progress-update';

  // Return early if state already updated
  // or not requesting closed state change
  if (updates.state || !isRequestingClosed) {
    return config;
  }

  // TODO: check that more than 1/2 way to due date

  const currentState = deficientItem.state;
  const isValidCurrentState = currentState === 'pending';

  if (isValidCurrentState) {
    updates.state = 'requires-progress-update';
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
  const isProgressingToPending = updates.state === 'pending';

  if (
    (isProgressingToPending && currentState === 'requires-action') ||
    currentState === 'go-back'
  ) {
    let currentDueDate = new Date();
    let currentDueDateUnix = 0;

    // Lookup any relevant current due date
    // prioritizing current due date change
    // then reverting to DI's current due date
    if (changes.currentDueDate && typeof changes.currentDueDate === 'number') {
      currentDueDate = new Date(changes.currentDueDate * 1000);
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
  const isRequestingIncomplete = changes.state === 'incomplete';

  // Return early if state updated or
  // not requesting incomplete state change
  if (updates.state || !isRequestingIncomplete) {
    return config;
  }

  const currentState = deficientItem.state;
  const isValidCurrentState = currentState === 'overdue';
  const hasCurrentReasonIncomplete = Boolean(
    changes.currentReasonIncomplete ? changes.currentReasonIncomplete[1] : ''
  );

  if (isValidCurrentState && hasCurrentReasonIncomplete) {
    updates.state = 'incomplete';
  }

  return config;
}

/**
 * Progress to completed state
 * when pending and a completed photo
 * has been provided
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @return {Object} - config
 */
function setCompletedState(config) {
  const { updates, deficientItem, changes } = config;
  const isRequestingCompleted = changes.state === 'completed';

  // Return early if state updated or
  // not requesting completed state change
  if (updates.state || !isRequestingCompleted) {
    return config;
  }

  const currentState = deficientItem.state;
  const isValidCurrentState = currentState === 'pending';
  const currentStartDate = deficientItem.currentStartDate || 0;
  const completedPhotos =
    updates.completedPhotos || deficientItem.completedPhotos || {};
  const hasRequiredUpdates = hasCurrentStartDate(
    currentStartDate,
    completedPhotos
  );

  if (isValidCurrentState && hasRequiredUpdates) {
    updates.state = 'completed';
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
  const updateDate = changes.currentDueDate || 0;

  if (updateDate && typeof updateDate === 'number') {
    const date = new Date(updateDate * 1000);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
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
  const { updates, deficientItem, authorID, createdAt } = config;
  const newState = updates.state || '';

  if (newState && newState !== deficientItem.state) {
    const id = uuid();

    updates.stateHistory = Object.create(null);
    updates.stateHistory[id] = {
      createdAt,
      state: newState,
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
  const dueTime = changes.currentDueDate || 0;
  const dueDay = changes.currentDueDateDay || updates.currentDueDateDay || '';

  if (
    dueTime &&
    typeof dueTime === 'number' &&
    dueTime !== deficientItem.currentDueDate
  ) {
    const id = uuid();
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates.dueDates = Object.create(null);
    updates.dueDates[id] = { createdAt, dueDate: dueTime };

    // Append current start date
    if (startDate) {
      updates.dueDates[id].startDate = startDate;
    }

    // Add optional due date day
    if (dueDay) {
      updates.dueDates[id].dueDateDay = dueDay;
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
  const deferDate = changes.currentDeferredDate || 0;

  if (deferDate && typeof deferDate === 'number') {
    const date = new Date(deferDate * 1000);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
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
  const { updates, changes, deficientItem, authorID, createdAt } = config;
  const deferTime = changes.currentDeferredDate || 0;
  const deferDay =
    changes.currentDeferredDateDay || updates.currentDeferredDateDay || '';

  if (
    deferTime &&
    typeof deferTime === 'number' &&
    deferTime !== deficientItem.currentDeferredDate
  ) {
    const id = uuid();

    updates.deferredDates = Object.create(null);
    updates.deferredDates[id] = {
      createdAt,
      deferredDate: deferTime,
    };

    // Add optional deferred day
    if (deferDay) {
      updates.deferredDates[id].deferredDateDay = deferDay;
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
  const planToFix = changes.currentPlanToFix || '';

  if (planToFix && planToFix !== deficientItem.currentPlanToFix) {
    const id = uuid();
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates.plansToFix = Object.create(null);
    updates.plansToFix[id] = {
      createdAt,
      planToFix,
    };

    // Append any start date
    if (startDate) {
      updates.plansToFix[id].startDate = startDate;
    }

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
  const { updates, changes, deficientItem, authorID, createdAt } = config;
  const completeNowReason = changes.currentCompleteNowReason || '';

  if (
    completeNowReason &&
    completeNowReason !== deficientItem.currentCompleteNowReason
  ) {
    const id = uuid();

    updates.completeNowReasons = Object.create(null);
    updates.completeNowReasons[id] = {
      createdAt,
      completeNowReason,
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
  const groupResponsible = changes.currentResponsibilityGroup || '';

  if (
    groupResponsible &&
    groupResponsible !== deficientItem.currentResponsibilityGroup
  ) {
    const id = uuid();
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates.responsibilityGroups = Object.create(null);
    updates.responsibilityGroups[id] = {
      createdAt,
      groupResponsible,
    };

    // Append start date
    if (startDate) {
      updates.responsibilityGroups[id].startDate = startDate;
    }

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
  const newReason = changes.currentReasonIncomplete || '';

  if (newReason && newReason !== deficientItem.currentReasonIncomplete) {
    const id = uuid();
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates.reasonsIncomplete = Object.create(null);
    updates.reasonsIncomplete[id] = {
      createdAt,
      reasonIncomplete: newReason,
    };

    // Append start date
    if (startDate) {
      updates.reasonsIncomplete[id].startDate = startDate;
    }

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
  const { updates, deficientItem, changes } = config;
  const startDate = changes.currentStartDate || updates.currentStartDate || 0;

  if (
    startDate &&
    typeof startDate === 'number' &&
    startDate !== deficientItem.currentStartDate
  ) {
    updates.startDates = Object.create(null);
    updates.startDates[uuid()] = { startDate };
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
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates.progressNotes = Object.create(null);
    updates.progressNotes[id] = {
      createdAt,
      progressNote,
    };

    // Append start date
    if (startDate) {
      updates.progressNotes[id].startDate = startDate;
    }

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
    return Math.round(dateOrTimestamp.getTime() / 1000); // is date
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

/**
 * Return first timestamp like argument
 * @param  {Any[]} args
 * @return {Number}
 */
function findFirstUnix(...args) {
  return args.filter(d => Boolean(d && typeof d === 'number'))[0] || 0;
}

/**
 * UNIX timestamp is after
 * 23 hours from current moment
 * @param  {Number?} timestamp
 * @return {Boolean}
 */
function isAfter23HoursFromNow(timestamp = 0) {
  let compare = typeof timestamp === 'number' ? timestamp : 0; // type check
  compare = timestamp === timestamp ? timestamp : 0; // NaN check
  const twentyThreeHoursFromNow = Math.round(Date.now() / 1000) + 23 * 60 * 60;
  return compare > twentyThreeHoursFromNow;
}

/**
 * Check that a hash has any
 * start date that matches the
 * provided current start date
 * @param  {Number} currentStartDate
 * @param  {Object?} hashTree
 * @return {Boolean}
 */
function hasCurrentStartDate(currentStartDate, hashTree = {}) {
  assert(
    typeof currentStartDate === 'number' &&
      currentStartDate === currentStartDate,
    'has current start date'
  );
  assert(hashTree && typeof hashTree === 'object', 'has hash tree');

  if (currentStartDate === 0 || Object.keys(hashTree).length === 0) {
    return false;
  }

  return Object.keys(hashTree)
    .map(id => hashTree[id].startDate)
    .some(sd => sd === currentStartDate);
}
