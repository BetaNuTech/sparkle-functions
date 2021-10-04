const assert = require('assert');
const usersModel = require('../../models/users');
const propertiesModel = require('../../models/properties');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'users: api: patch-user:';

/**
 * Factory for creating a PATCH endpoint
 * for individual users
 * @param {admin.firestore} db
 * @param {admin.auth} auth
 * @return {Function} - onRequest handler
 */
module.exports = function createPatch(db, auth) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(Boolean(auth), 'has firebase auth instance');

  /**
   * Handle PATCH request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {}, params } = req;
    const reqUserId = req.user.id;
    const { userId: targetUserId } = params;
    const { superAdmin, admin, corporate, isDisabled, teams } = body;
    const send500Error = create500ErrHandler(PREFIX, res);

    const claimsUpdates = {};
    if (typeof admin === 'boolean') claimsUpdates.admin = admin;
    if (typeof corporate === 'boolean') claimsUpdates.corporate = corporate;
    if (typeof superAdmin === 'boolean') claimsUpdates.superAdmin = superAdmin;
    const hasDisabledUpdate = typeof isDisabled === 'boolean';
    const hasClaimsUpdate = Boolean(Object.keys(claimsUpdates).length);
    const hasTeamsUpdate = Object.hasOwnProperty.call(body, 'teams');
    const isRemovingTeams =
      hasTeamsUpdate && Boolean(Object.keys(teams || {}).length === 0);
    const isUpsertingTeams = hasTeamsUpdate && !isRemovingTeams;

    // Reject invalid request
    if (!hasDisabledUpdate && !hasClaimsUpdate && !hasTeamsUpdate) {
      return res.status(400).send({
        errors: [{ detail: 'Request invalid' }],
      });
    }

    // Reject setting user to a Corprate Admin
    // user can either be an admin or a corporate (not both)
    if (claimsUpdates.admin && claimsUpdates.corporate) {
      return res.status(400).send({
        errors: [{ detail: 'Cannot set corporate admin' }],
      });
    }

    // Get requesting user's current custom claim state
    let hasUpdatePermission = false;
    try {
      hasUpdatePermission = await usersModel.hasUpdatePermission(
        auth,
        reqUserId,
        body
      );
    } catch (err) {
      return send500Error(err, 'Failed to lookup requestor update permissions');
    }

    // Reject request from non-admin
    if (!hasUpdatePermission) {
      const reqLevel = body.superAdmin ? 'super admins' : 'admins';
      return res.status(401).send({
        errors: [
          { detail: `You do not have permission to update ${reqLevel}` },
        ],
      });
    }

    // Check target user exists
    let targetAuthUser = null;
    try {
      targetAuthUser = await usersModel.getAuthUser(auth, targetUserId);
    } catch (err) {
      return send500Error(err, '', 'failed to lookup auth user');
    }

    if (!targetAuthUser) {
      return res.status(404).send({
        errors: [{ detail: `Requested user "${targetUserId}" does not exist` }],
      });
    }

    // Disable/Enable User
    if (hasDisabledUpdate) {
      try {
        await usersModel.setAuthUserDisabled(auth, targetUserId, isDisabled);
      } catch (err) {
        return send500Error(err, '', 'failed to set auth user disabled');
      }
    }

    // Update target user's Custom Claims
    if (hasClaimsUpdate) {
      try {
        await usersModel.upsertCustomClaims(auth, targetUserId, claimsUpdates);
      } catch (err) {
        return send500Error(err, '', 'failed custom claims update');
      }
    }

    const dbUpdate = { ...claimsUpdates };

    // Remove Corporate / Admin properties
    if (claimsUpdates.admin || claimsUpdates.corporate) {
      dbUpdate.properties = {};
    }

    try {
      await db.runTransaction(async transaction => {
        // Remove all a user's teams associations
        if (isRemovingTeams) {
          dbUpdate.teams = {};
        }

        // Update user's teams
        if (isUpsertingTeams) {
          // Collect requested truethy team ids
          // all falsey/existing teams will be removed
          const teamsUpsertIds = Object.keys(teams || {}).filter(teamId =>
            Boolean(teams[teamId])
          );

          let propertyTeamsSnap = null;
          try {
            propertyTeamsSnap = await propertiesModel.findAllTeamRelationships(
              db,
              transaction
            );
          } catch (err) {
            return send500Error(
              err,
              'Properties lookup failed',
              'failed to complete user record update'
            );
          }

          // Nested hash of each team's properties
          // Example: `{ team: { property: true } }`
          const teamsWithProperties = propertyTeamsSnap.docs.reduce(
            (acc, doc) => {
              const propertyId = doc.id;
              const teamId = doc.data().team;
              acc[teamId] = acc[teamId] || {};
              acc[teamId][propertyId] = true;
              return acc;
            },
            {}
          );

          // Teams update (replaces existing teams)
          // Example: `{ team1: true, team2: { property: true } }`
          dbUpdate.teams = teamsUpsertIds.reduce((acc, teamId) => {
            acc[teamId] = teamsWithProperties[teamId]
              ? { ...teamsWithProperties[teamId] } // Clone all team's properties
              : true; // Just set user's team membership
            return acc;
          }, {});
        }

        // Update target users' Realtime DB record
        if (hasDisabledUpdate) dbUpdate.isDisabled = isDisabled;
        delete dbUpdate.superAdmin; // not persisted to Firebase DB

        // Has updates to persist
        if (Object.keys(dbUpdate).length) {
          try {
            // Update Firestore
            await usersModel.upsertRecord(
              db,
              targetUserId,
              dbUpdate,
              transaction
            );
          } catch (err) {
            return send500Error(
              err,
              'user upsert failed',
              'failed to complete user record update'
            );
          }
        }

        let targetUser = null;
        try {
          targetUser = await usersModel.findRecord(db, targetUserId);
          if (!targetUser.exists) throw Error('target user does not exist');
        } catch (err) {
          return send500Error(
            err,
            'Firestore target user lookup failed',
            'Unexpected error'
          );
        }

        // Success
        res.status(200).send({
          data: {
            type: 'user',
            id: targetUser.id,
            attributes: targetUser.data(),
          },
        });
      });
    } catch (err) {
      return send500Error(
        err,
        'Database transaction failed',
        'failed to complete user record update'
      );
    }
  };
};
