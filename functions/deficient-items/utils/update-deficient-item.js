const assert = require('assert');
const pipe = require('../../utils/pipe');
const config = require('../../config');

const FIVE_DAYS_IN_SEC = 432000;
const OVERDUE_ELIGIBLE_STATES = config.deficientItems.overdueEligibleStates;

/**
 * Save a deficient item with updates
 * relavant to its' target state
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @param  {Number?} updatedAt
 * @param  {String?} progressNote
 * @param  {Object?} completedPhotos - hash tree of completed photos
 * @return {Object?} - Deficient Item updates
 */
module.exports = function updateDeficientItem(
  deficientItem,
  changes,
  authorID = '',
  updatedAt = Math.round(Date.now() / 1000),
  progressNote = '',
  completedPhotos = null
) {
  assert(
    deficientItem && typeof deficientItem === 'object',
    'has deficient item'
  );
  assert(changes && typeof changes === 'object', 'has changes object');
  assert(
    updatedAt && typeof updatedAt === 'number',
    'has numeric updated at timestamp'
  );
  assert(updatedAt > 0, 'has viable timestamp');

  return pipe(
    setPendingState,
    setDeferredState,
    setIncompleteState,
    setGoBackState,
    setClosedState,
    setRequiresProgressUpdateState,
    setWillRequireProgressNote,
    applyGoBackStateSideEffects,
    setCurrentDueDate,
    setCurrentDueDateDay,
    setCurrentStartDate,
    appendDueDate,
    setCurrentDeferredDate,
    setCurrentDeferredDateDay,
    appendDeferredDate,
    setCurrentPlanToFix,
    appendPlanToFix,
    setCompleteNowReasons,
    appendCompleteNowReasons,
    setCurrentResponsibilityGroup,
    appendResponsibilityGroup,
    setCurrentReasonIncomplete,
    appendReasonIncomplete,
    appendStartDate,
    appendProgressNote,
    appendCompletedPhotos,
    setCompletedState, // NOTE: must be after appendCompletedPhotos
    setOverdueState,
    setIsDuplicate,
    appendStateHistory,
    setUpdatedAt
  )({
    updates: Object.create(null),
    deficientItem: JSON.parse(JSON.stringify(deficientItem)),
    changes,
    authorID,
    updatedAt,
    progressNote,
    completedPhotos,
  }).updates;
};

/**
 * Removed all current content on go back
 * TODO: drop this middleware after below
 *       migration is completed
 * @param  {Object} updates
 * @param  {Object} changes
 * @return {Object} - config
 */
function applyGoBackStateSideEffects(config) {
  const { updates } = config;
  const isProgressingToGoBack = updates.state === 'go-back';

  if (isProgressingToGoBack) {
    updates.currentPlanToFix = null; // TODO move to setCurrentPlanToFix
    updates.currentDueDate = null; // TODO move to setCurrentDueDate
    updates.currentDueDateDay = null; // TODO move to setCurrentDueDateDay
    updates.currentDeferredDate = null; // TODO move to setCurrentDeferredDate
    updates.currentDeferredDateDay = null; // TODO move to setCurrentDeferredDateDay
    updates.currentResponsibilityGroup = null; // TODO move to setCurrentResponsibilityGroup
    updates.currentStartDate = null; // TODO move to setCurrentStartDate
    updates.currentCompleteNowReason = null; // TODO move tosetCompleteNowReasons
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
 * Set new state to overdue
 * when deficiency is eligible
 * @param {Object} updates
 * @param {Object} deficientItem
 * @return {Object} - config
 */
function setOverdueState(config) {
  const { updates, deficientItem, updatedAt: now } = config;
  const currentState = deficientItem.state;
  const currentDueDate = deficientItem.currentDueDate || 0;

  // Second measurements until DI becomes "overdue"
  const secondsUntilDue = currentDueDate - now;
  const isStateNotUpdated = Boolean(updates.state) === false;
  const isOverdueEligible = OVERDUE_ELIGIBLE_STATES.includes(currentState);
  const isPastDue = secondsUntilDue <= 0;

  // Set eligible, overdue, deficiency to overdue state
  if (isStateNotUpdated && isOverdueEligible && isPastDue) {
    updates.state = 'overdue';
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
  const isUpdatingReasonIncomplete = Boolean(changes.currentReasonIncomplete);
  const hasCurrentReasonIncomplete = Boolean(
    deficientItem.currentReasonIncomplete
  );

  if (
    isValidCurrentState &&
    (isUpdatingReasonIncomplete || hasCurrentReasonIncomplete)
  ) {
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

  // Convert completed photos updates
  // into history hash from flat firestore
  // compatible "path.attributes"
  // NOTE: defaults to `null`
  const updatedPhotos = Object.keys(updates).reduce((acc, attr) => {
    if (attr.search(/^completedPhotos\./) === 0) {
      acc = acc || {};
      const [, photoId] = attr.split('.');
      acc[photoId] = updates[attr];
    }

    return acc;
  }, null);

  const completedPhotos = updatedPhotos || deficientItem.completedPhotos || {};
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
 * Set the current due date
 * from users updates
 * @param  {Object} updates
 * @param  {Object} changes
 * @return {Object} - config
 */
function setCurrentDueDate(config) {
  const { updates, changes } = config;
  const updateDate = changes.currentDueDate || 0;

  if (updateDate && typeof updateDate === 'number') {
    updates.currentDueDate = updateDate;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function setCurrentStartDate(config) {
  const { updates, updatedAt } = config;

  if (updates.state === 'pending') {
    updates.currentStartDate = updatedAt;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendStateHistory(config) {
  const { updates, deficientItem, authorID, updatedAt } = config;
  const newState = updates.state || '';

  if (newState && newState !== deficientItem.state) {
    const updateKey = `stateHistory.${uuid()}`;
    const { currentStartDate } = deficientItem;
    const isStartDateRequired = [
      'overdue',
      'requires-progress-update',
    ].includes(newState);
    const hasStartDate = Boolean(currentStartDate);

    updates[updateKey] = {
      createdAt: updatedAt,
      state: newState,
    };

    // Add start date when
    // required & available
    if (isStartDateRequired && hasStartDate) {
      updates[updateKey].startDate = currentStartDate;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendDueDate(config) {
  const { updates, deficientItem, changes, authorID, updatedAt } = config;
  const dueTime = changes.currentDueDate || 0;
  const dueDay = changes.currentDueDateDay || updates.currentDueDateDay || '';

  if (
    dueTime &&
    typeof dueTime === 'number' &&
    dueTime !== deficientItem.currentDueDate
  ) {
    const updateKey = `dueDates.${uuid()}`;
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates[updateKey] = { createdAt: updatedAt, dueDate: dueTime };

    // Append current start date
    if (startDate) {
      updates[updateKey].startDate = startDate;
    }

    // Add optional due date day
    if (dueDay) {
      updates[updateKey].dueDateDay = dueDay;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
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
 * Set the current deferred date
 * @param   {Object} update
 * @param   {Object} changes
 * @return  {Object} - config
 */
function setCurrentDeferredDate(config) {
  const { updates, changes } = config;
  const updateDate = changes.currentDeferredDate || 0;

  if (updateDate && typeof updateDate === 'number') {
    updates.currentDeferredDate = updateDate;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendDeferredDate(config) {
  const { updates, changes, deficientItem, authorID, updatedAt } = config;
  const deferTime = changes.currentDeferredDate || 0;
  const deferDay =
    changes.currentDeferredDateDay || updates.currentDeferredDateDay || '';

  if (
    deferTime &&
    typeof deferTime === 'number' &&
    deferTime !== deficientItem.currentDeferredDate
  ) {
    const updateKey = `deferredDates.${uuid()}`;

    updates[updateKey] = {
      createdAt: updatedAt,
      deferredDate: deferTime,
    };

    // Add optional deferred day
    if (deferDay) {
      updates[updateKey].deferredDateDay = deferDay;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
    }
  }

  return config;
}

/**
 * Set valid current plan to fix
 * @param {Object} updates
 * @param {Object} changes
 * @return {Object} config
 */
function setCurrentPlanToFix(config) {
  const { updates, changes } = config;
  const updatePlan = changes.currentPlanToFix || '';

  if (updatePlan && typeof updatePlan === 'string') {
    updates.currentPlanToFix = updatePlan;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendPlanToFix(config) {
  const { updates, deficientItem, changes, authorID, updatedAt } = config;
  const planToFix = changes.currentPlanToFix || '';

  if (planToFix && planToFix !== deficientItem.currentPlanToFix) {
    const updateKey = `plansToFix.${uuid()}`;
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates[updateKey] = {
      createdAt: updatedAt,
      planToFix,
    };

    // Append any start date
    if (startDate) {
      updates[updateKey].startDate = startDate;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
    }
  }

  return config;
}

/**
 * Set the complete now reason
 * @param   {Object} update
 * @param   {Object} changes
 * @return  {Object} - config
 */
function setCompleteNowReasons(config) {
  const { updates, changes } = config;
  const updateReason = changes.currentCompleteNowReason || '';

  if (updateReason && typeof updateReason === 'string') {
    updates.currentCompleteNowReason = updateReason;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendCompleteNowReasons(config) {
  const { updates, changes, deficientItem, authorID, updatedAt } = config;
  const completeNowReason = changes.currentCompleteNowReason || '';

  if (
    completeNowReason &&
    completeNowReason !== deficientItem.currentCompleteNowReason
  ) {
    const updateKey = `completeNowReasons.${uuid()}`;
    updates[updateKey] = {
      createdAt: updatedAt,
      completeNowReason,
    };

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
    }
  }

  return config;
}

/**
 * Set valid current
 * responsibility group
 * @param {Object} updates
 * @param {Object} changes
 * @return {Object} config
 */
function setCurrentResponsibilityGroup(config) {
  const { updates, changes } = config;
  const updateGroup = changes.currentResponsibilityGroup || '';

  if (updateGroup && typeof updateGroup === 'string') {
    updates.currentResponsibilityGroup = updateGroup;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendResponsibilityGroup(config) {
  const { updates, deficientItem, changes, authorID, updatedAt } = config;
  const groupResponsible = changes.currentResponsibilityGroup || '';

  if (
    groupResponsible &&
    groupResponsible !== deficientItem.currentResponsibilityGroup
  ) {
    const updateKey = `responsibilityGroups.${uuid()}`;
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    updates[updateKey] = {
      createdAt: updatedAt,
      groupResponsible,
    };

    // Append start date
    if (startDate) {
      updates[updateKey].startDate = startDate;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
    }
  }

  return config;
}

/**
 * Set the current reason
 * incomplete when provided
 * or remove it when deficiency
 * exists the `incomplete` state
 * @param  {Object} update
 * @param  {Object} changes
 * @param  {Object} deficientItem
 * @return  {Object} - config
 */
function setCurrentReasonIncomplete(config) {
  const { updates, changes, deficientItem } = config;
  const isEnteringIncomplete = updates.state === 'incomplete';
  const hasExistingReason = Boolean(deficientItem.currentReasonIncomplete);
  const updateReason = changes.currentReasonIncomplete || '';

  if (
    isEnteringIncomplete &&
    updateReason &&
    typeof updateReason === 'string'
  ) {
    updates.currentReasonIncomplete = updateReason;
  } else if (!isEnteringIncomplete && hasExistingReason) {
    updates.currentReasonIncomplete = null;
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
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function appendReasonIncomplete(config) {
  const { updates, deficientItem, authorID, updatedAt } = config;
  const newReason = updates.currentReasonIncomplete || '';

  if (newReason && newReason !== deficientItem.currentReasonIncomplete) {
    const id = uuid();
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    const updateKey = `reasonsIncomplete.${id}`;
    updates[updateKey] = {
      createdAt: updatedAt,
      reasonIncomplete: newReason,
    };

    // Append start date
    if (startDate) {
      updates[updateKey].startDate = startDate;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
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
    updates[`startDates.${uuid()}`] = { startDate };
  }

  return config;
}

/**
 * Add optional progress note to history
 * @param  {Object} updates
 * @param  {Object} deficientItem
 * @param  {Object} changes
 * @param  {String?} authorID
 * @param  {Number} updatedAt
 * @param  {String?} progressNote
 * @return {Object} - config
 */
function appendProgressNote(config) {
  const { updates, deficientItem, authorID, updatedAt, progressNote } = config;

  if (progressNote) {
    const id = uuid();
    const startDate = findFirstUnix(
      updates.currentStartDate,
      deficientItem.currentStartDate
    );

    const updateKey = `progressNotes.${id}`;
    updates[updateKey] = {
      createdAt: updatedAt,
      progressNote,
    };

    // Append start date
    if (startDate) {
      updates[updateKey].startDate = startDate;
    }

    // Add optional user
    if (authorID) {
      updates[updateKey].user = authorID;
    }
  }

  return config;
}

/**
 * Add an optional completed photo to DI's
 * `completedPhotos` configuration
 * @param  {Object} updates
 * @param  {Object} completedPhotos
 * @return {Object} - config
 */
function appendCompletedPhotos(config) {
  const { updates, completedPhotos } = config;

  if (completedPhotos) {
    // Append completed photos as nested writes
    Object.keys(completedPhotos).forEach(id => {
      updates[`completedPhotos.${id}`] = completedPhotos[id];
    });
  }

  return config;
}

/**
 * Set is duplicate
 * @param   {Object} update
 * @param   {Object} changes
 * @return  {Object} - config
 */
function setIsDuplicate(config) {
  const { updates, changes } = config;
  const updateIsDuplicate = changes.isDuplicate;

  if (typeof updateIsDuplicate === 'boolean') {
    updates.isDuplicate = updateIsDuplicate;
  }

  return config;
}

/**
 * Set updated at if there's any updates
 * @param  {Object} changes
 * @param  {Number} updatedAt
 * @return {Object} - config
 */
function setUpdatedAt(config) {
  const { updates, updatedAt } = config;

  if (Object.keys(updates).length) {
    updates.updatedAt = updatedAt;
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
