const assert = require('assert');
const log = require('../../utils/logger');
const usersModel = require('../../models/users');
const teamsModel = require('../../models/teams');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'teams: api: delete:';

/**
 * Factory for creating a DELETE endpoint
 * that delete's a Firebase team and cleanup
 * all associations with properties & users
 * @param {admin.firestore} db
 * @return {Function} - onRequest handler
 */
module.exports = function createDelete(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle DELETE request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params } = req;
    const { teamId } = params;
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`Delete team: "${teamId}" requested`);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Lookup Team
    let team = null;
    try {
      const teamSnap = await teamsModel.findRecord(db, teamId);
      team = teamSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'team lookup failed', 'unexpected error');
    }

    // Reject when team can't be found
    if (!team) {
      log.error(`${PREFIX} requested team: "${teamId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'team' },
            title: 'Team not found',
          },
        ],
      });
    }

    try {
      await db.runTransaction(async transaction => {
        // Lookup team's properties
        const propertiesOfTeamIds = [];
        try {
          const propertiesOfTeamSnap = await propertiesModel.query(
            db,
            {
              team: ['==', teamId],
            },
            transaction
          );
          propertiesOfTeamIds.push(
            ...propertiesOfTeamSnap.docs.map(({ id }) => id)
          );
        } catch (err) {
          throw Error(
            `failed to lookup properties associated with team: ${err}`
          );
        }

        // Lookup team's users
        const usersOfTeamIds = [];
        try {
          const usersInRemovedTeamSnap = await usersModel.findByTeam(
            db,
            teamId,
            transaction
          );
          usersOfTeamIds.push(
            ...usersInRemovedTeamSnap.docs.map(({ id }) => id)
          );
        } catch (err) {
          throw Error(`failed to lookup users associated with team: ${err}`);
        }

        // Add team delete to batch
        try {
          await teamsModel.removeRecord(db, teamId, transaction);
        } catch (err) {
          throw Error(`team removal failed: ${err}`);
        }

        // Cleanup team's properties
        if (propertiesOfTeamIds.length) {
          try {
            await propertiesModel.batchRemoveTeam(
              db,
              propertiesOfTeamIds,
              transaction
            );
          } catch (err) {
            throw Error(`error removing team from properties: ${err}`);
          }
        }

        // Cleanup team's users
        if (usersOfTeamIds.length) {
          try {
            await usersModel.batchRemoveTeam(
              db,
              usersOfTeamIds,
              teamId,
              transaction
            );
          } catch (err) {
            throw Error(`error removing team from users: ${err}`);
          }
        }
      });
    } catch (err) {
      return send500Error(
        err,
        'team delete and association cleanup transaction failed',
        'unexpected error'
      );
    }

    if (!incognitoMode) {
      try {
        // Notify of new inspection report
        await notificationsModel.addRecord(db, {
          title: 'Team Deletion',
          summary: notifyTemplate('team-delete-summary', {
            name: team.name,
            authorName,
          }),
          markdownBody: notifyTemplate('team-delete-markdown-body', {
            name: team.name,
            authorName,
            authorEmail,
          }),
          creator: req.user ? req.user.id || '' : '',
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification | ${err}`); // proceed with error
      }
    }

    // Successful delete
    res.status(200).send();
  };
};
