const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const processPropertyMeta = require('../properties/utils/process-meta');

const PREFIX = 'deficient-items: on-di-state-update:';
const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;

/**
 * Factory for Deficient Items sync on DI state updates
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @param  {functions.pubsub} pubsubClient
 * @param  {String} statusUpdateTopic
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiStateUpdateHandler(
  db,
  fs,
  pubsubClient,
  statusUpdateTopic
) {
  assert(Boolean(db), 'has realtime DB instance');
  assert(Boolean(fs), 'has firestore DB instance');
  assert(Boolean(pubsubClient), 'has pubsub client');
  assert(
    statusUpdateTopic && typeof statusUpdateTopic === 'string',
    'has status update topic'
  );

  const diStatusUpdatePublisher = pubsubClient
    .topic(statusUpdateTopic)
    .publisher();

  return async (change, event) => {
    const updates = {};
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
      try {
        await processPropertyMeta(db, fs, propertyId);
        log.info(`${PREFIX} updated property's deficient item metadata`);
      } catch (err) {
        log.error(`${PREFIX} property metadata update failed | ${err}`);
      }
    }

    // Publish DI status update event
    if (beforeState !== afterState) {
      try {
        await diStatusUpdatePublisher.publish(
          Buffer.from(`${propertyId}/${deficientItemId}/state/${afterState}`)
        );
      } catch (err) {
        log.error(
          `${PREFIX} publishing DI status update event failed | ${err}`
        );
      }
    }

    return updates;
  };
};
