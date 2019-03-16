const assert = require('assert');
const express = require('express');
const cors = require('cors');
const authUser = require('../utils/auth-firebase-user');
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
  if (process.env.NODE_ENV !== 'test') assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Write /sendMessages records for recipient users
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const createPushNotificationHandler = async (req, res) => {
    const userId = req.user ? req.user.id : '';
    log.info(`${LOG_PREFIX} push notification requested by user: ${userId}`);
    res.status(201).send({ success: true });
  };

  // Create express app with single endpoint
  // that configures required url params
  const app = express();
  app.use(cors());
  const middleware = [auth ? authUser(db, auth) : null, createPushNotificationHandler].filter(Boolean);
  app.post('/', ...middleware);
  return app;
}
