const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationModel = require('../../models/integrations');
const sendSlackChannelMessage = require('./utils/send-slack-channel-message');

const PREFIX = `slack: pubsub: publish-slack-notification:`;

/**
 * Clean any lingering /push-messages from database
 * when pubsub client receives a message
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
 */
module.exports = function publishSlackNotification(topic = '', pubSub, db) {
  // Subscribe to `notifications-sync`
  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};

    let accessToken = '';
    try {
      const slackIntegrationCredentialsSnap = await systemModel.findSlackCredentials(
        db
      );

      if (!slackIntegrationCredentialsSnap.exists()) {
        throw Error(
          `${PREFIX} ${topic}: slack authentication credentials not found.`
        );
      }

      const slackCredentials = slackIntegrationCredentialsSnap.val();
      accessToken = slackCredentials.accessToken;
    } catch (err) {
      throw Error(
        `${PREFIX} ${topic}: system slack credential lookup error | ${err}`
      );
    }

    let notifications = null;
    try {
      const notificationsSnap = await integrationModel.findAllSlackNotifications(
        db
      );

      if (!notificationsSnap.exists()) return;
      notifications = notificationsSnap.val() || {};
    } catch (err) {
      throw Error(
        `${PREFIX} ${topic}: error retrieving notifications | ${err}`
      );
    }

    const allChannels = Object.keys(notifications);

    // Join any channels before
    // sending notifications
    for (let i = 0; i < allChannels.length; i++) {
      const channelName = allChannels[i];

      try {
        const responseBody = await integrationModel.joinSlackChannel(
          db,
          accessToken,
          channelName
        );

        if (responseBody && !responseBody.already_in_channel) {
          // Log newly joined channel
          log.info(
            `${PREFIX} ${topic} successfully joined new channel: "${channelName}"`
          );
        }
      } catch (err) {
        log.error(
          `${PREFIX} ${topic}: error joining channel ${channelName} error | ${err}`
        );
      }
    }

    // For each Slack channel
    for (let i = 0; i < allChannels.length; i++) {
      const channelName = allChannels[i];
      const notificationIds = Object.keys(notifications[channelName]);

      // For each notification in channel
      for (let k = 0; k < notificationIds.length; k++) {
        const notificationId = notificationIds[k];
        const notification = notifications[channelName][notificationId];

        try {
          await sendSlackChannelMessage(
            accessToken,
            channelName,
            notification.title,
            notification.message
          );
          log.info(
            `${PREFIX} ${topic}: successfully sent notification "${notificationId}" to channel "${channelName}"`
          );
        } catch (err) {
          log.error(`${PREFIX} ${topic}: error from Slack API | ${err}`);
          continue; // eslint-disable-line
        }

        // Cleanup notification record
        try {
          await integrationModel.removeSlackNotification(
            db,
            channelName,
            notificationId
          );
          updates[`/notifications/slack/${channelName}/${notificationId}`] =
            'removed';
        } catch (err) {
          log.error(
            `${PREFIX} ${topic}: delete notification record error | ${err}`
          );
        }
      }
    }

    return updates;
  });
};