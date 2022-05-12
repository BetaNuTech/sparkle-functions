const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');
const slack = require('../../services/slack');

const PREFIX = 'notifications: pubsub: publish-slack-v2:';

/**
 * Publish a slack nofication to its'
 * Slack Channel and update the source
 * notification as published to slack
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @return {functions.CloudFunction}
 */
module.exports = function publishSlackNotification(db, pubsub, topic) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(topic && typeof topic === 'string', 'has pubsub topic');

  return pubsub.topic(topic).onPublish(async message => {
    let accessToken = '';
    try {
      const credentialsSnap = await systemModel.findSlack(db);
      const slackCredentials = credentialsSnap.data() || null;
      accessToken = slackCredentials ? slackCredentials.accessToken : '';

      if (!accessToken) {
        throw Error('slack authentication credentials not found');
      }
    } catch (err) {
      throw Error(`${PREFIX} ${err}`);
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
        `${PREFIX} message parsing failed, targeting all slack notifications | ${err}`
      );
    }

    // Hash of all notifications
    // to publish, grouped by channel
    const notifications = {};

    try {
      let notificationsSnap = null;

      if (channelTarget !== '*') {
        // Select slack notifications for a channel notification
        log.info(
          `${PREFIX} publishing slack notifications for channel: "${channelTarget}"`
        );

        notificationsSnap = await notificationsModel.query(db, {
          'slack.channel': ['==', channelTarget],
        });

        // Add all notifications to channel
        notificationsSnap.docs.forEach(doc => {
          const data = (doc.data() || {}).slack;

          if (data) {
            notifications[channelTarget] = notifications[channelTarget] || [];
            notifications[channelTarget].push({ id: doc.id, ...data });
          }
        });
      } else {
        // Select all slack notifications
        notificationsSnap = await notificationsModel.query(db, {
          'slack.createdAt': ['>', 0],
        });

        notificationsSnap.docs.forEach(doc => {
          const data = (doc.data() || {}).slack;
          const channel = data ? data.channel : '';

          if (data && channel) {
            notifications[channel] = notifications[channel] || [];
            notifications[channel].push({ id: doc.id, ...data });
          }
        });
      }
    } catch (err) {
      throw Error(`${PREFIX} error retrieving notifications | ${err}`);
    }

    const batch = db.batch();
    const allChannels = Object.keys(notifications);
    const joinedChannels = [];

    // Join any channels before
    // sending notifications
    for (let i = 0; i < allChannels.length; i++) {
      const channelName = allChannels[i];

      try {
        const responseBody = await slack.joinChannel(accessToken, channelName);

        if (responseBody && !responseBody.already_in_channel) {
          joinedChannels.push(channelName);
          log.info(`${PREFIX} joined new channel: "${channelName}"`);
        }
      } catch (err) {
        log.error(
          `${PREFIX} failed to join Slack channel: "${channelName}" | ${err}`
        );
      }
    }

    // Persist joined Slack channels
    // to public facing integration
    if (joinedChannels.length) {
      const nowUnix = Math.round(Date.now() / 1000);
      const slackIntegrationUpdate = joinedChannels.reduce(
        (acc, channleName) => {
          acc[`joinedChannelNames.${channleName}`] = nowUnix;
          return acc;
        },
        {}
      );

      try {
        await integrationsModel.updateSlack(db, slackIntegrationUpdate, batch);
      } catch (err) {
        // Allow failure
        log.error(
          `${PREFIX} failed to update integration with joined Slack channels | ${err}`
        );
      }
    }

    // Send each Slack notification
    // for each Slack channel group
    for (let i = 0; i < allChannels.length; i++) {
      const channelName = allChannels[i];

      // For each notification in channel
      for (let k = 0; k < notifications[channelName].length; k++) {
        const notification = notifications[channelName][k];
        const notificationId = notification.id;

        try {
          await slack.sendSlackChannelMessage(
            accessToken,
            channelName,
            notification.message,
            notification.title
          );
          log.info(
            `${PREFIX} published notification "${notificationId}" to Slack channel: "${channelName}"`
          );
        } catch (err) {
          log.error(`${PREFIX} error publishing message to Slack API | ${err}`);
          continue; // eslint-disable-line
        }

        // Mark notification as published to Slack
        try {
          await notificationsModel.updateRecord(
            db,
            notificationId,
            {
              'publishedMediums.slack': true,
            },
            batch
          );
        } catch (err) {
          // Allow failure
          log.error(
            `${PREFIX} failed to mark notification as published to slack | ${err}`
          );
        }
      }
    }

    // Commit all updates
    // to firestore database
    try {
      await batch.commit();
    } catch (err) {
      throw Error(`${PREFIX} failed to commit database writes | ${err}`);
    }
  });
};
