const assert = require('assert');
const log = require('./logger');
const usersModel = require('../models/users');

const PREFIX = 'utils: auth-firebase-user:';

/**
 * Creates a middleware instance to handle
 * verifying Firebase auth tokens and setting `req.user`
 * NOTE: Side effect sets `req.user` upon successful lookup or rejects request
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.Auth} auth - Firebase service for user auth
 * @param  {Boolean?} shouldBeAdmin
 * @param  {Object?} permissionLevels
 * @return {Promise} verification & lookup requests
 */
module.exports = function authFirebaseUser(
  db,
  auth,
  shouldBeAdmin = false,
  permissionLevels = {}
) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  // User permissions levels instead
  // of "shouldBeAdmin"
  if (typeof shouldBeAdmin === 'object') {
    permissionLevels = shouldBeAdmin;
    shouldBeAdmin = false;
  }

  return async function strategy(req, res, next) {
    const { params } = req;
    const { authorization } = req.headers;
    const propertyId = params ? params.propertyId : '';

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
      const userSnap = await usersModel.getUser(db, decodedToken.uid);
      const user = userSnap.val();

      if (shouldBeAdmin && !user.admin) {
        throw Error('Non-admin users cannot access this route');
      }

      // Permission level checks
      const requiresPermission = Boolean(Object.keys(permissionLevels).length);
      const allowAdminAccess = Boolean(permissionLevels.admin);
      const allowCorpAccess = Boolean(permissionLevels.corporate);
      const allowPropAccess = Boolean(permissionLevels.property && propertyId);
      const allowTeamAccess = Boolean(permissionLevels.team && propertyId);

      let hasPermission = false;
      if (allowAdminAccess && user.admin) {
        hasPermission = true; // allow admins
      } else if (allowCorpAccess && user.corporate) {
        hasPermission = true; // allow corporates
      } else if (
        allowPropAccess &&
        user.properties &&
        user.properties[propertyId]
      ) {
        hasPermission = true; // allow property level
      } else if (
        allowTeamAccess &&
        hasPropertyInTeams(user.teams || {}, propertyId)
      ) {
        hasPermission = true; // allow team leads
      }

      if (!hasPermission && requiresPermission) {
        throw Error('user lacks permission level to access this route');
      }

      // set request user
      req.user = req.user || {};
      Object.assign(req.user, user);
      req.user.id = req.user.id || decodedToken.uid; // add user ID

      next();
    } catch (e) {
      log.error(`${PREFIX} ${e}`);
      sendInvalidCred();
    }

    function sendInvalidCred() {
      res.status(401).send({ message: 'invalid credentials' });
      next(new Error('invalid credentials')); // stop proceeding middleware
    }
  };
};

/**
 * Search for a user's property level
 * access from within their teams
 * @param  {Object} teams
 * @param  {String} propertyId
 * @return {Boolean} - user has team level access to a property
 */
function hasPropertyInTeams(teams, propertyId) {
  assert(teams && typeof teams === 'object', 'has user teams configuration');
  assert(propertyId && typeof propertyId === 'string', 'has property ID');

  const teamIds = Object.keys(teams);
  for (let i = 0; i < teamIds.length; i++) {
    const teamId = teamIds[i];
    if (teams[teamId][propertyId]) {
      return true; // found property within team
    }
  }

  return false;
}
