const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationModel = require('../../models/integrations');
const slack = require('../../services/slack');

const PREFIX = 'notifications: pubsub: publish-slack-notification:';

/**
 * Publish a slack nofication to its'
 * Slack Channel and remove the slack notification's
 * configuration upon success
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @return {functions.CloudFunction}
 */
module.exports = function publishSlackNotification(topic = '', pubSub, db) {
  assert(topic && typeof topic === 'string', 'has pubsub topic');
  assert(Boolean(pubSub), 'has pubsub firebase instance');
  assert(Boolean(db), 'has firebase admin database instance');
  return pubSub.topic(topic).onPublish(async message => {
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
      throw Error(`${PREFIX} ${topic} | ${err}`);
    }

    // Parse individual target
    // from message or select all
    let channelTarget = '*';
    try {
      channelTarget =
        message && message.data
          ? Buffer.from(message.data, 'base64').toString()
          : '*';
    } catch (err) {
      log.warn(
        `${PREFIX} message parsing failed, targeting all slack notifications`
      );
    }

    let notifications = null;
    const allChannels = [];

    try {
      let notificationsSnap = null;

      if (channelTarget !== '*') {
        // Select slack notifications for a channel notification
        log.info(
          `${PREFIX} ${topic}: publishing slack notifications for channel: "${channelTarget}"`
        );

        notificationsSnap = await integrationModel.findSlackNotificationsByChannel(
          db,
          channelTarget
        );

        if (notificationsSnap.exists) {
          notifications = { [channelTarget]: notificationsSnap.val() };
          allChannels.push(channelTarget);
        }
      } else {
        // Select all slack notifications
        log.info(`${PREFIX} ${topic}: publishing all slack notifications`);

        notificationsSnap = await integrationModel.findAllSlackNotifications(
          db
        );

        notifications = notificationsSnap.val() || {};
        allChannels.push(...Object.keys(notifications));
      }

      if (!notificationsSnap || !notificationsSnap.exists()) return;
    } catch (err) {
      throw Error(
        `${PREFIX} ${topic}: error retrieving notifications | ${err}`
      );
    }

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
          await slack.sendSlackChannelMessage(
            accessToken,
            channelName,
            notification.message,
            notification.title
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
        } catch (err) {
          log.error(
            `${PREFIX} ${topic}: delete notification record error | ${err}`
          );
        }
      }
    }
  });
};
