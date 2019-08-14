const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const processPropertyMeta = require('../properties/process-meta');
const systemModel = require('../models/system');

const PREFIX = 'deficient-items: on-di-state-update:';
const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;

/**
 * Factory for Deficient Items sync on DI state updates
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiStateUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId, itemId: deficientItemId } = event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(deficientItemId), 'has deficient item ID');

    log.info(
      `${PREFIX} property: ${propertyId} | deficient item: ${deficientItemId}`
    );

    const beforeState = change.before.val();
    const afterState = change.after.val();
    const stillRequiresAction =
      REQUIRED_ACTIONS_VALUES.includes(beforeState) &&
      REQUIRED_ACTIONS_VALUES.includes(afterState);
    const stillFollowUpAction =
      FOLLOW_UP_ACTION_VALUES.includes(beforeState) &&
      FOLLOW_UP_ACTION_VALUES.includes(afterState);

    // Action required action status changed
    if (
      !stillRequiresAction &&
      !stillFollowUpAction &&
      beforeState !== afterState
    ) {
      await processPropertyMeta(db, propertyId);
      log.info(
        `${PREFIX} updated property: ${propertyId} deficient items associated metadata`
      );
    }

    // Close any Trello card for DI
    let trelloCardResponse = null;
    if (afterState === 'closed') {
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

    return updates;
  };
};
