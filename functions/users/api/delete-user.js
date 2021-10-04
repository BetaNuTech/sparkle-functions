const assert = require('assert');
const log = require('../../utils/logger');
const usersModel = require('../../models/users');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'users: api: delete-user:';

/**
 * Factory for creating a DELETE endpoint
 * that delete's a Firebase project user
 * @param {admin.firestore} db
 * @param {admin.auth} auth
 * @return {Function} - onRequest handler
 */
module.exports = function createDelete(db, auth) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Handle DELETE request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params } = req;
    const { userId: targetUserId } = params;
    const send500Error = create500ErrHandler(PREFIX, res);

    // Lookup any auth/realtime DB user recors for the param UID
    let authUser = null;
    let existingRealtimeUser = null;
    try {
      authUser = await usersModel.getAuthUser(auth, targetUserId);
      const userSnap = await usersModel.findRecord(db, targetUserId);
      existingRealtimeUser = userSnap.data() || null;
    } catch (err) {
      log.info(
        `${PREFIX} provided uid "${targetUserId}" has no auth user record`
      );
    }

    // Reject request to create user that doesn't exist
    if (!existingRealtimeUser) {
      return res.status(404).send({
        errors: [{ detail: `no user found for "${targetUserId}"` }],
      });
    }

    if (authUser) {
      try {
        await usersModel.deleteAuthUser(auth, targetUserId);
      } catch (err) {
        return send500Error(
          err,
          '',
          'Failed to complete delete please try again'
        );
      }
    }

    try {
      await usersModel.deleteRecord(db, targetUserId);
    } catch (err) {
      return send500Error(
        err,
        'Firestore user delete failed',
        'Failed to complete delete please try again'
      );
    }

    // Successful delete
    res.status(200).send({ message: 'success' });
  };
};
