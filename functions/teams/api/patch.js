const assert = require('assert');
const log = require('../../utils/logger');
const strings = require('../../utils/strings');
const teamsModel = require('../../models/teams');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'teams: api: put:';

/**
 * Factory for creating a PATCH team endpoint
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */

module.exports = function createPatchTeam(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {}, params } = req;
    const { teamId } = params;
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Update team requested');

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;
    const hasValidRequest = body && body.name && typeof body.name === 'string';

    // Send bad request error
    if (!hasValidRequest) {
      log.error(`${PREFIX} invalid team request`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'name' },
            title: 'name is required',
            detail: 'body missing "name" attribute',
          },
        ],
      });
    }

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

    const updatedTeamName = strings.toCapitalize(body.name);
    const isNewTeamName = updatedTeamName !== team.name;

    if (!isNewTeamName) {
      log.error(
        `${PREFIX} request to update team with same name: "${updatedTeamName}"`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'name' },
            title: 'name is unchanged',
            detail: `Team name was not changed from "${updatedTeamName}", please provide an updated name`,
          },
        ],
      });
    }

    // Titlized team name
    let isTeamNameAvailable = false;

    try {
      const teamsWithName = await teamsModel.query(db, {
        name: ['==', updatedTeamName],
      });
      isTeamNameAvailable = teamsWithName.size === 0;
    } catch (err) {
      return send500Error(err, 'team name query failed', 'unexpected error');
    }

    if (!isTeamNameAvailable) {
      log.error(
        `${PREFIX} request to update team with existing name: "${updatedTeamName}"`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'name' },
            title: 'name is taken',
            detail: `Team name "${updatedTeamName}" is already taken, please choose another`,
          },
        ],
      });
    }

    // Update team
    try {
      await teamsModel.updateRecord(db, teamId, { name: updatedTeamName });
    } catch (err) {
      return send500Error(err, 'team update failed', 'unexpected error');
    }

    if (!incognitoMode) {
      try {
        // Notify of updated team
        await notificationsModel.addRecord(db, {
          title: 'Team Update',
          summary: notifyTemplate('team-update-summary', {
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate('team-update-markdown-body', {
            name: updatedTeamName,
            authorName,
            authorEmail,
          }),
          creator: req.user ? req.user.id || '' : '',
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }

    // Send newly created team
    res.status(201).send({
      data: {
        id: teamId,
        type: 'team',
        attributes: {
          name: updatedTeamName,
        },
      },
    });
  };
};
