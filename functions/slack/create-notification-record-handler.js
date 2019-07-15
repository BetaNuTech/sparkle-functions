const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');

const PREFIX = 'slack: create notification record:';

/**
 * Factory for creating notification records for slack endpoint
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase authentication object
 * @param  {firebaseAdmin.pubsubClient} pubsubClient - Firebase pubsub client
 * @param  {string} notificationTopic - topic which should be published to when function is complete
 * @return {Function} - onRequest handler
 */
module.exports = function createOnSlackNotificationHandler(
  db,
  auth,
  pubsubClient,
  notificationTopic
) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Write slack app notification
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const createSlackNotificationHandler = async (req, res) => {
    const { user, body } = req;
    const { title, message: userMessage, property: propertyId } = body;

    // Reject unauthenticated request
    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${PREFIX} requested by user: ${user.id}`);

    // Reject impropertly stuctured request body
    if (!title || !userMessage) {
      let message = '';

      if (!body) {
        message = 'invalid request';
        log.error(`${PREFIX} request badly formed`);
      } else {
        message += 'Slack Notification Records requires:';

        if (!title) {
          message += ' title';
          log.error(`${PREFIX} request body missing title`);
        }

        if (!userMessage) {
          message += ' message';
          log.error(`${PREFIX} request body missing message`);
        }
      }

      return res.status(400).send({ message });
    }

    let channelName = '';

    // Property notification
    if (propertyId) {
      let propertySnap = null;
      try {
        propertySnap = await db.ref(`/properties/${propertyId}`).once('value');
      } catch (err) {
        log.error(`${PREFIX} property lookup failed: ${err}`);
        return res.status(500).send({ message: 'Internal Error' });
      }

      if (!propertySnap.exists()) {
        const message = 'property cannot be found';
        return res.status(409).send({ message });
      }

      const property = propertySnap.val();
      if (!property.slackChannel) {
        return res.status(409).send({
          message: 'no Slack channel associated with this property',
        });
      }

      channelName = property.slackChannel;
    }

    // Admin notification
    if (!propertyId) {
      let slackAdminChannelNameSnap = null;
      try {
        slackAdminChannelNameSnap = await db
          .ref('/integrations/slack/organization/channelName')
          .once('value');
      } catch (err) {
        log.error(
          `${PREFIX} organization slack channel integration lookup failed: ${err}`
        );
        return res.status(500).send({ message: 'Internal Error' });
      }

      if (!slackAdminChannelNameSnap.exists()) {
        return res
          .status(409)
          .send({ message: 'Admin channel has not been setup' });
      }

      channelName = slackAdminChannelNameSnap.val();
    }

    // Create notification record
    // and queue notification sync task
    try {
      const notificationRef = db
        .ref(`/notifications/slack/${channelName.replace(/#/g, '')}`)
        .push();
      await notificationRef.set({ title, message: userMessage });

      const publisher = pubsubClient.topic(notificationTopic).publisher();
      await publisher.publish();

      log.info(
        `${PREFIX} created slack notification: ${notificationRef.path.toString()}`
      );

      res
        .status(201)
        .send({ message: 'successfully saved slack app authorization' });
    } catch (err) {
      log.error(
        `${PREFIX} failed to create and/or publish Slack notification: ${err}`
      );
      return res.status(500).send({ message: 'Internal Error' });
    }
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post(
    '/notifications',
    authUser(db, auth, true),
    createSlackNotificationHandler
  );
  return app;
};
