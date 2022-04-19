const assert = require('assert');
const log = require('../utils/logger');
const usersModel = require('../models/users');

const PREFIX = 'middleware: auth-user-crud-request:';
const METHOD_KEY = {
  post: 'create',
  patch: 'update',
  put: 'update',
  get: 'read',
};

/**
 * Creates a middleware instance to handle
 * verifying requesting user has necessary custom
 * claims needed to make CRUD operations on the
 * Firebase project's users
 * @param  {firebaseAdmin.Auth} auth - Firebase service for user auth
 * @return {Promise} verification & lookup requests
 */
module.exports = function authUserCrud(auth) {
  assert(Boolean(auth), 'has firebase auth instance');

  return async function handler(req, res, next) {
    const reqUserId = req.user.id;

    // Reject request without create permissions
    let hasCrudPermission = false;
    try {
      // Throw error when "auth-firebase-user"
      // middleware was not placed before this
      // middleware in the pipeline
      if (!reqUserId) {
        throw Error(
          'request user not set, ensure auth-firebase-user is added before this middleware'
        );
      }

      hasCrudPermission = await usersModel.hasCrudPermission(auth, reqUserId);
    } catch (err) {
      log.error(
        `${PREFIX}: authUserCrud: failed to lookup permissions: ${err}`
      );
      return res.status(500).send({
        errors: [
          {
            detail: 'failed to verify request permissions, please try again',
          },
        ],
      });
    }

    // Reject request from non-admin
    if (!hasCrudPermission) {
      const method = req.method.toLowerCase();
      const opertation = METHOD_KEY[method] || method;
      return res.status(401).send({
        errors: [
          { detail: `You do not have permission to ${opertation} users` },
        ],
      });
    }

    next();
  };
};
