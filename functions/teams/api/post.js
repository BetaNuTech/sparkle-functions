const assert = require('assert');
const log = require('../../utils/logger');
const strings = require('../../utils/strings');
const teamsModel = require('../../models/teams');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'teams: api: post:';

/**
 * Factory for creating a POST team endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */

module.exports = function createPostTeam(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Create team requested');

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

    // Titlized team name
    let isTeamNameAvailable = false;
    const teamName = strings.toCapitalize(body.name);

    try {
      const teamsWithName = await teamsModel.query(db, {
        name: ['==', teamName],
      });
      isTeamNameAvailable = teamsWithName.size === 0;
    } catch (err) {
      return send500Error(err, 'team name query failed', 'unexpected error');
    }

    if (!isTeamNameAvailable) {
      log.error(
        `${PREFIX} request to create team with existing name: "${teamName}"`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'name' },
            title: 'name is taken',
            detail: `Team name "${teamName}" is already taken, please choose another`,
          },
        ],
      });
    }

    // Generate unique team ID
    const teamId = teamsModel.createId(db);

    try {
      await teamsModel.createRecord(db, teamId, { name: teamName });
    } catch (err) {
      return send500Error(err, 'team creation failed', 'unexpected error');
    }

    if (!incognitoMode) {
      try {
        // Notify of new team
        await notificationsModel.addRecord(db, {
          title: 'Team Creation',
          summary: notifyTemplate('team-created-summary', {
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate('team-created-markdown-body', {
            name: teamName,
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
          name: teamName,
        },
      },
    });
  };
};
