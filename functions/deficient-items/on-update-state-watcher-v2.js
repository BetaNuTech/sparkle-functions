const assert = require('assert');
const log = require('../utils/logger');
const config = require('../config');
const diModel = require('../models/deficient-items');
const propertiesModel = require('../models/properties');

const PREFIX = 'deficient-items: on-di-state-update-v2:';
const REQUIRED_ACTIONS_VALUES = config.deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = config.deficientItems.followUpActionStates;

/**
 * Factory for Deficient Items sync on DI state updates
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @param  {functions.pubsub} pubsubClient
 * @param  {String} statusUpdateTopic
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiStateUpdateHandler(
  db,
  pubsubClient,
  statusUpdateTopic
) {
  assert(
    db && typeof db.collection === 'function',
    'has firestore DB instance'
  );
  assert(
    pubsubClient && typeof pubsubClient.topic === 'function',
    'has pubsub client'
  );
  assert(
    statusUpdateTopic && typeof statusUpdateTopic === 'string',
    'has status update topic'
  );

  const diStatusUpdatePublisher = pubsubClient
    .topic(statusUpdateTopic)
    .publisher();

  return async (change, context) => {
    const updates = {};
    const { deficiencyId } = context.params;

    assert(Boolean(deficiencyId), 'has deficient item ID');

    // Lookup parent record
    let deficiency = null;
    try {
      const diSnap = await diModel.findRecord(db, deficiencyId);
      deficiency = diSnap.data() || {};
      if (!deficiency.property) {
        throw Error('invalid deficiency missing property');
      }
    } catch (err) {
      log.error(
        `${PREFIX} failed to lookup Deficient Item "${deficiencyId}" | ${err}`
      );
    }

    const beforeState = (change.before.data() || {}).state || '';
    const afterState = (change.after.data() || {}).state || '';
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
        await propertiesModel.updateMetaData(db, deficiency.property);
        log.info(`${PREFIX} updated property's deficient item metadata`);
      } catch (err) {
        log.error(`${PREFIX} property metadata update failed | ${err}`);
      }
    }

    // Publish DI status update event
    if (beforeState !== afterState) {
      try {
        await diStatusUpdatePublisher.publish(
          Buffer.from(
            `${deficiency.property}/${deficiencyId}/state/${afterState}`
          )
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
