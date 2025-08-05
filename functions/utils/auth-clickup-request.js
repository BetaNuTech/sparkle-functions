const assert = require('assert');
const log = require('./logger');
const systemModel = require('../models/system');

const PREFIX = 'utils: auth-clickup-request:';

/**
 * Creates a middleware instance to handle
 * lookup of ClickUp credentials and making sure
 * that requesting user has permission to access them
 * before setting `req.clickupCredentials`
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - Express middleware
 */
module.exports = function authClickUpRequest(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  return async function middleware(req, res, next) {
    const { user } = req;

    if (!user) {
      log.error(`${PREFIX} user not defined on request`);
      res.status(500).send({ message: 'System failure' });
      return next(Error('improperly defined middleware'));
    }

    let clickupCredentials = null;
    try {
      const clickupCredentialsSnap = await systemModel.findClickUp(db);
      const isClickUpAuthorized = clickupCredentialsSnap.exists;

      if (!isClickUpAuthorized) {
        res.status(409).send({ message: 'ClickUp credentials not created' });
        return next(Error('Database not populated'));
      }

      clickupCredentials = clickupCredentialsSnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} Error accessing ClickUp token: ${err}`);
      res.status(500).send({ message: 'Error accessing ClickUp token' });
      return next(Error('Database failure'));
    }

    // Check if credentials are still valid
    if (!clickupCredentials.apiToken) {
      log.error(`${PREFIX} ClickUp API token is missing`);
      res.status(409).send({ message: 'ClickUp API token is invalid' });
      return next(Error('Invalid credentials'));
    }

    // Set ClickUp credentials on request
    req.clickupCredentials = req.clickupCredentials || {};
    Object.assign(req.clickupCredentials, clickupCredentials);
    next();
  };
};
