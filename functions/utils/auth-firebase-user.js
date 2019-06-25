const assert = require('assert');
const log = require('./logger');

const LOG_PREFIX = 'utils: auth-firebase-user:';

/**
 * Creates a middleware instance to handle
 * verifying Firebase auth tokens and setting `req.user`
 * NOTE: Side effect sets `req.user` upon successful lookup or rejects request
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.Auth} auth - Firebase service for user auth
 * @param  {Boolean?} shouldBeAdmin
 * @return {Promise} verification & lookup requests
 */
module.exports = function authFirebaseUser(db, auth, shouldBeAdmin = false) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  return async function strategy(req, res, next) {
    const { authorization } = req.headers;

    // Is authentication requested?
    if (!authorization) {
      return sendInvalidCred();
    }

    const tokenType = `${authorization}`.split(' ').shift(); // take type

    // Is Firebase JWT Authorization requested?
    if (tokenType.toLowerCase() !== 'fb-jwt') {
      return sendInvalidCred(); // TODO: allow other auth strategies
    }

    const idToken = `${authorization}`.split(' ').pop(); // take token

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      const userResult = await getUserById(db, decodedToken.uid, shouldBeAdmin);

      // set request user
      req.user = req.user || {};
      Object.assign(req.user, userResult);

      next();
    } catch (e) {
      log.error(`${LOG_PREFIX} ${e}`);
      sendInvalidCred();
    }

    function sendInvalidCred() {
      res.status(401).send({ message: 'invalid credentials' });
      next(new Error('invalid credentials')); // stop proceeding middleware
    }
  };
};

/**
 * Request a user by their id
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {String} userId
 * @param  {Boolean} shouldBeAdmin
 * @return {Promise} - resolves {Object} user
 */
function getUserById(db, userId, shouldBeAdmin) {
  assert(Boolean(db), 'has firebase database instance');
  assert(
    userId && typeof userId === 'string',
    `has valid user id got: ${userId}`
  );

  return new Promise((resolve, reject) =>
    db
      .ref(`/users/${userId}`)
      .once('value')
      .then(snapshot => {
        const user = snapshot.val();

        if (!user) {
          return reject(null);
        }

        if (shouldBeAdmin && !user.admin) {
          reject(Error('Only admins can access this route'));
        }
        user.id = userId;
        resolve(user); // Success
      }, reject)
  );
}
