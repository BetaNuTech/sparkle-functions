const functions = require('firebase-functions');
const deficiency = require('./deficient-items');
const notifications = require('./notifications');

module.exports = (
  db,
  fs,
  pubsubClient,
  storage,
  functionsPubSub,
  messaging
) => {
  return {
    deficiencyTrelloCardStateComments: deficiency.pubsub.trelloCardStateComment(
      fs,
      functions.pubsub,
      'deficient-item-status-update'
    ),

    deficiencyTrelloCardClose: deficiency.pubsub.trelloCardClose(
      fs,
      functions.pubsub,
      'deficient-item-status-update'
    ),

    deficiencyTrelloCardDueDates: deficiency.pubsub.trelloCardDueDate(
      fs,
      functions.pubsub,
      'deficient-item-status-update'
    ),

    deficiencySyncOverdue: deficiency.pubsub.syncOverdue(
      fs,
      functions.pubsub,
      'deficient-items-sync'
    ),

    publishSlackNotificationsV2: notifications.pubsub.publishSlack(
      fs,
      functionsPubSub,
      'notifications-slack-sync'
    ),

    publishPushNotificationsV2: notifications.pubsub.publishPush(
      fs,
      functionsPubSub,
      'push-messages-sync',
      messaging
    ),

    // Replaces: cleanupNotifications
    cleanupNotificationsV2: notifications.pubsub.cleanPublished(
      fs,
      functionsPubSub,
      'notifications-sync'
    ),
  };
};
