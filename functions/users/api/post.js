const assert = require('assert');
const isValidEmail = require('../../utils/valid-email');
const log = require('../../utils/logger');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const usersModel = require('../../models/users');

const PREFIX = 'users: api: post-user:';

/**
 * Factory for creating a POST endpoint
 * that creates a Firebase project's users
 * @param {admin.firestore} db
 * @param {admin.auth} auth
 * @return {Function} - onRequest handler
 */
module.exports = function createPatch(db, auth) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const { firstName, lastName, email } = body;
    const send500Error = create500ErrHandler(PREFIX, res);

    // Reject invalid first name
    if (!firstName || typeof firstName !== 'string') {
      return res.status(400).send({
        errors: [
          {
            detail: 'invalid "firstName" provided',
            source: { pointer: 'firstName' },
          },
        ],
      });
    }

    // Reject invalid last name
    if (!lastName || typeof lastName !== 'string') {
      return res.status(400).send({
        errors: [
          {
            detail: 'invalid "lastName" provided',
            source: { pointer: 'lastName' },
          },
        ],
      });
    }

    // Reject invalid email
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return res.status(400).send({
        errors: [
          {
            detail: 'invalid "email" provided',
            source: { pointer: 'email' },
          },
        ],
      });
    }

    // Lookup any auth/realtime DB user recors for email
    let authUser = null;
    let existingRealtimeUser = null;
    try {
      authUser = await usersModel.getAuthUserByEmail(auth, email);
      const userSnap = await usersModel.findRecord(db, authUser.uid);
      existingRealtimeUser = userSnap.data() || null;
    } catch (err) {
      log.info(`${PREFIX} provided email "${email}" has no auth user record`);
    }

    // Reject request to create user that already exists
    if (authUser && existingRealtimeUser) {
      return res.status(403).send({
        errors: [
          {
            detail: 'user with that email already exists',
          },
        ],
      });
    }

    const attributes = {
      firstName,
      lastName,
      email,
      admin: false,
      corporate: false,
      isDisabled: false,
      pushOptOut: false,
      courtesyOfficer: false,
      createdAt: Math.round(Date.now() / 1000),
    };

    // Claim the user ID up front so the Firestore record can be written
    // before the Auth account exists. Order matters: the auth gate blocking
    // function (see auth-gate/) refuses to create an Auth account for any
    // address without a matching users record, so creating the Auth user
    // first would have this endpoint rejected by our own gate. Writing
    // Firestore first also means a failure part way through leaves a record
    // an administrator can see and retry, rather than an orphaned Auth
    // account that is invisible in the app.
    const userId = authUser ? authUser.uid : usersModel.createId(db);

    // Create new Firestore record
    try {
      await usersModel.upsertRecord(db, userId, attributes);
    } catch (err) {
      return send500Error(
        err,
        'Firestore user create failed',
        'failed to complete user creation'
      );
    }

    // Create Firebase Auth user
    // NOTE: this step is optional
    // to account for potential failure
    // and allow end users to retry POST
    if (!authUser) {
      try {
        authUser = await usersModel.createAuthUser(auth, email, userId);
      } catch (err) {
        return send500Error(err);
      }
    }

    // Success
    res.status(201).send({
      data: {
        type: 'user',
        id: userId,
        attributes,
      },
    });
  };
};
