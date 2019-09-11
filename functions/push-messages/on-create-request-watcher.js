const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const authUser = require('../utils/auth-firebase-user');
const { forEachChild } = require('../utils/firebase-admin');
const {
  pushSendMessage,
  getRecepients,
} = require('../utils/firebase-messaging');
const log = require('../utils/logger');

const LOG_PREFIX = 'push-messages: create:';

/**
 * Factory for send message creation endpoint
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth?} auth - Firebase Admin auth service instance (optional for testing)
 * @return {Function} - onRequest handler
 */
module.exports = function createOnCreatePushNotificationHandler(db, auth) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Write /sendMessages records for recipient users
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const createPushNotificationHandler = async (req, res) => {
    const { user, body } = req;
    const { notification } = body;

    if (!user) {
      return res.status(401).send({ message: 'request not authorized' });
    }

    log.info(`${LOG_PREFIX} requested by user: ${user.id}`);

    if (!user.admin) {
      log.error(`${LOG_PREFIX} requested by non-admin user: ${user.id}`);
      return res.status(403).send({ message: 'requester not admin' });
    }

    // Reject impropertly stuctured request body
    if (!notification || !notification.title || !notification.message) {
      let message = '';

      if (!notification) {
        message = 'invalid request';
        log.error(`${LOG_PREFIX} request badly formed`);
      } else {
        message += 'notification requires:';

        if (!notification.title) {
          message += ' title';
          log.error(`${LOG_PREFIX} request body missing notification title`);
        }

        if (!notification.message) {
          message += ' message';
          log.error(`${LOG_PREFIX} request body missing notification message`);
        }
      }

      return res.status(400).send({ message });
    }

    const users = [];
    await forEachChild(db, '/users', async function sendMessageForUser(
      userId,
      user
    ) {
      users.push(Object.assign({ id: userId }, user));
    });
    const recipientIds = getRecepients({
      users,
      excludes: [user.id],
      allowCorp: false,
    });

    // Send message for each user
    for (let i = 0; i < recipientIds.length; i++) {
      try {
        const userId = recipientIds[i];
        const messageId = await pushSendMessage(db, {
          title: notification.title,
          message: notification.message,
          recipientId: userId,
        });
        log.info(
          `${LOG_PREFIX} created send message record: ${messageId} for user: ${userId}`
        );
      } catch (e) {
        log.error(`${LOG_PREFIX} ${e}`);
      }
    }

    res.status(201).send({ message: 'completed successfully' });
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post('/', authUser(db, auth), createPushNotificationHandler);
  return app;
};
