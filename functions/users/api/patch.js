const assert = require('assert');
const log = require('../../utils/logger');
const usersModel = require('../../models/users');
const propertiesModel = require('../../models/properties');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const { getFullName } = require('../../utils/user');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

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
    const {
      superAdmin,
      admin,
      corporate,
      isDisabled,
      teams,
      properties,
    } = body;
    const send500Error = create500ErrHandler(PREFIX, res);
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const claimsUpdates = {};
    const hasAdminUpdate = typeof admin === 'boolean';
    const hasCorporateUpdate = typeof corporate === 'boolean';
    const hasSuperAdminUpdate = typeof superAdmin === 'boolean';
    if (hasAdminUpdate) claimsUpdates.admin = admin;
    if (hasCorporateUpdate) claimsUpdates.corporate = corporate;
    if (hasSuperAdminUpdate) claimsUpdates.superAdmin = superAdmin;
    const hasDisabledUpdate = typeof isDisabled === 'boolean';
    const hasClaimsUpdate = isValidHashUpdate(claimsUpdates);
    const hasTeamsUpdate = isValidHashUpdate(teams);
    const hasPropertiesUpdate = isValidHashUpdate(properties);
    const hasFirstNameUpdate =
      Boolean(body.firstName) && typeof body.firstName === 'string';
    const hasLastNameUpdate =
      Boolean(body.lastName) && typeof body.lastName === 'string';
    const hasPushOptOutUpdate = typeof body.pushOptOut === 'boolean';
    const hasUpdates = Boolean(
      hasDisabledUpdate ||
        hasClaimsUpdate ||
        hasTeamsUpdate ||
        hasPropertiesUpdate ||
        hasFirstNameUpdate ||
        hasLastNameUpdate ||
        hasPushOptOutUpdate
    );

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Reject invalid request
    if (!hasUpdates) {
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
        targetUserId,
        {
          admin: hasAdminUpdate,
          corporate: hasCorporateUpdate,
          superAdmin: hasSuperAdminUpdate,
          isDisabled: hasDisabledUpdate,
          teams: hasTeamsUpdate,
          properties: hasPropertiesUpdate,
          firstName: hasFirstNameUpdate,
          lastName: hasLastNameUpdate,
          pushOptOut: hasPushOptOutUpdate,
        }
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

    // Get user data before completing
    // user update for notifications
    let originalTargetUser = null;
    if (!incognitoMode) {
      try {
        const snapshot = await usersModel.findRecord(db, targetUserId);
        originalTargetUser = snapshot.data() || {};
      } catch (err) {
        return send500Error(
          err,
          'Target user lookup failed',
          'Unexpected error'
        );
      }
    }

    const dbUpdate = { ...claimsUpdates };

    try {
      await db.runTransaction(async transaction => {
        // Update user's teams
        if (hasTeamsUpdate) {
          // Collect requested truethy team ids
          // all falsey/existing teams will be removed
          const teamsUpsertIds = Object.keys(teams || {}).filter(teamId =>
            Boolean(teams[teamId])
          );

          const propertiesOfTeams = [];
          if (teamsUpsertIds.length) {
            try {
              const propertyTeamsSnap = await propertiesModel.findAllTeamRelationships(
                db,
                transaction
              );
              propertiesOfTeams.push(...propertyTeamsSnap.docs);
            } catch (err) {
              return send500Error(
                err,
                'Properties lookup failed',
                'failed to complete user record update'
              );
            }
          }

          // Nested hash of each team's properties
          // Example: `{ team: { property: true } }`
          const teamsWithProperties = propertiesOfTeams
            .map(doc => ({ ...doc.data(), id: doc.id }))
            .filter(property => Boolean(property.team)) // sanity check
            .reduce((acc, property) => {
              const propertyId = property.id;
              const teamId = property.team;
              acc[teamId] = acc[teamId] || {};
              acc[teamId][propertyId] = true;
              return acc;
            }, {});

          // Teams update (replaces existing teams)
          // Example: `{ team1: true, team2: { property: true } }`
          const teamUpsertUpdates = teamsUpsertIds.reduce((acc, teamId) => {
            acc[teamId] = teamsWithProperties[teamId]
              ? { ...teamsWithProperties[teamId] } // Clone all team's properties
              : true; // Just set user's team membership
            return acc;
          }, {});

          // Set removed team associations
          const teamsRemovalUpdates = Object.keys(teams || {})
            .filter(teamId => Boolean(teams[teamId]) === false)
            .reduce((acc, teamId) => {
              acc[teamId] = null; // must be null for model
              return acc;
            }, {});

          // Combine all team updates
          dbUpdate.teams = { ...teamUpsertUpdates, ...teamsRemovalUpdates };
        }

        // Update user's properties
        if (hasPropertiesUpdate) {
          // Set removed team associations
          dbUpdate.properties = Object.keys(properties || {})
            // .filter(teamId => Boolean(teams[teamId]) === false)
            .reduce((acc, propertyId) => {
              if (Boolean(properties[propertyId]) === false) {
                acc[propertyId] = null; // must be null for model
              } else {
                acc[propertyId] = true;
              }
              return acc;
            }, {});
        }

        // Add profile updates
        if (hasFirstNameUpdate) {
          dbUpdate.firstName = body.firstName;
        }
        if (hasLastNameUpdate) {
          dbUpdate.lastName = body.lastName;
        }
        if (hasPushOptOutUpdate) {
          dbUpdate.pushOptOut = body.pushOptOut;
        }

        // Update target users' Realtime DB record
        if (hasDisabledUpdate) dbUpdate.isDisabled = isDisabled;
        delete dbUpdate.superAdmin; // not persisted to Firebase DB

        // Has updates to persist
        if (Object.keys(dbUpdate).length) {
          try {
            // Update Firestore
            await usersModel.setRecord(
              db,
              targetUserId,
              dbUpdate,
              transaction,
              true
            );
          } catch (err) {
            return send500Error(
              err,
              'user upsert failed',
              'failed to complete user record update'
            );
          }
        }
      });
    } catch (err) {
      return send500Error(
        err,
        'Database transaction failed',
        'failed to complete user record update'
      );
    }

    let targetUser = null;
    try {
      const snapshot = await usersModel.findRecord(db, targetUserId);
      if (!snapshot.exists) throw Error('target user does not exist');
      targetUser = snapshot.data() || {};
    } catch (err) {
      return send500Error(err, 'target user lookup failed', 'Unexpected error');
    }

    // Success
    res.status(200).send({
      data: {
        type: 'user',
        id: targetUserId,
        attributes: targetUser,
      },
    });

    // Return without sending any notifications
    if (incognitoMode) {
      return;
    }

    const userFullName = getFullName(targetUser || {});
    const userEmail = targetUser.email || '';
    const previousName = getFullName(originalTargetUser || {});
    const currentName = userFullName;
    const previousAdmin = `${Boolean(originalTargetUser.admin)}`; // truethy string
    const currentAdmin = `${Boolean(targetUser.admin)}`; // truethy string
    const previousCorporate = `${Boolean(originalTargetUser.corporate)}`; // truethy string
    const currentCorporate = `${Boolean(targetUser.corporate)}`; // truethy string
    const previousTeamCount = `${hashCount(originalTargetUser.teams)}`;
    const currentTeamCount = `${hashCount(targetUser.teams)}`; // truethy string
    const previousPropertyCount = `${hashCount(originalTargetUser.properties)}`; // truethy string
    const currentPropertyCount = `${hashCount(targetUser.properties)}`; // truethy string
    const isPreviouslyDisabled = Boolean(originalTargetUser.isDisabled);
    const isCurrentlyDisabled = Boolean(targetUser.isDisabled);

    // Determine which of 2 user
    // notifications should be sent
    const isSendingUserDisabledNotification =
      isCurrentlyDisabled && isCurrentlyDisabled !== isPreviouslyDisabled;
    const isSendingUserUpdateNotification =
      !isSendingUserDisabledNotification && Object.keys(dbUpdate).length;

    if (isSendingUserDisabledNotification) {
      log.info(`${PREFIX} sending global User Disabled notification`);
      try {
        await notificationsModel.addRecord(db, {
          title: 'User Disabled',
          summary: notifyTemplate('user-disabled-summary', {
            disabledEmail: userEmail,
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate('user-disabled-markdown-body', {
            disabledName: userFullName,
            disabledEmail: userEmail,
            authorName,
            authorEmail,
          }),
          creator: authorId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }

    if (isSendingUserUpdateNotification) {
      log.info(`${PREFIX} sending global User Update notification`);
      await notificationsModel.addRecord(db, {
        title: 'User Update',
        summary: notifyTemplate('user-update-summary', {
          userEmail,
          authorName,
          authorEmail,
        }),
        markdownBody: notifyTemplate('user-update-markdown-body', {
          previousName,
          currentName,
          previousAdmin,
          currentAdmin,
          previousCorporate,
          currentCorporate,
          previousTeamCount,
          currentTeamCount,
          previousPropertyCount,
          currentPropertyCount,
          authorName,
          authorEmail,
        }),
        creator: authorId,
      });
    }
  };
};

/**
 * Is a valid hash map update
 * that contains any content
 * @param  {Object} hash
 * @return {Boolean}
 */
function isValidHashUpdate(hash = {}) {
  return hash && typeof hash === 'object' && Object.keys(hash).length > 0;
}

/**
 * Count the number of entries in a hash
 * @param  {Object?} obj
 * @return {Number}
 */
function hashCount(obj = {}) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return 0;
  }

  return Object.keys(obj).length;
}
