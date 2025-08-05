const assert = require('assert');
const log = require('../../utils/logger');
const clickup = require('../../services/clickup');
const systemModel = require('../../models/system');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'clickup: api: post-auth:';

/**
 * Factory for ClickUp authorization endpoint
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPostClickUpAuth(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Store ClickUp API token and workspace details
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, body } = req;
    const apiToken = (body || {}).apiToken || '';
    const workspaceId = (body || {}).workspaceId || '';
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Optional incognito mode query
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set JSON API formatted response
    res.set('Content-Type', 'application/vnd.api+json');

    // Reject invalid request
    if (!apiToken) {
      return res.status(400).send({
        errors: [{ detail: 'ClickUp authorization requires: apiToken' }],
      });
    }

    // Verify API token and get workspace details
    let teams = [];
    let selectedWorkspace = null;
    try {
      const teamsResponse = await clickup.fetchTeams(apiToken);
      teams = teamsResponse.teams || [];

      // If workspaceId provided, verify it exists
      if (workspaceId) {
        selectedWorkspace = teams.find(team => team.id === workspaceId);
        if (!selectedWorkspace) {
          return res.status(400).send({
            errors: [
              {
                detail:
                  'Invalid workspaceId - workspace not found or not accessible',
              },
            ],
          });
        }
      } else {
        // Use first available workspace if none specified
        selectedWorkspace = teams[0];
      }
    } catch (err) {
      log.error(`${PREFIX} Error retrieving ClickUp teams: ${err}`);
      return res.status(401).send({
        errors: [{ detail: 'ClickUp API token request not authorized' }],
      });
    }

    if (!selectedWorkspace) {
      return res.status(401).send({
        errors: [{ detail: 'No accessible workspaces found for this ClickUp token' }],
      });
    }

    const batch = db.batch();

    // Persist ClickUp credentials to system DB
    try {
      await systemModel.upsertClickUp(
        db,
        {
          apiToken,
          workspaceId: selectedWorkspace.id,
          user: user.id,
        },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `Error saving ClickUp system credentials: ${err}`,
        'Error saving ClickUp credentials'
      );
    }

    // Extract user details from workspace members
    const userMember = selectedWorkspace.members ? selectedWorkspace.members[0] : null;
    const member = userMember ? userMember.id : '';
    const clickupUsername = userMember ? userMember.username : '';
    const clickupEmail = userMember ? userMember.email : '';

    // Persist ClickUp integration details for clients
    let integrationDetails = null;
    try {
      integrationDetails = await integrationsModel.upsertClickUp(
        db,
        {
          member,
          clickupUsername,
          clickupEmail,
          clickupWorkspaceName: selectedWorkspace.name,
          workspaceId: selectedWorkspace.id,
          workspaceName: selectedWorkspace.name,
          workspaceColor: selectedWorkspace.color || '#7b68ee',
          workspaceAvatar: selectedWorkspace.avatar || null,
          availableWorkspaces: teams.map(team => ({
            id: team.id,
            name: team.name,
            color: team.color || '#7b68ee',
            avatar: team.avatar || null,
          })),
        },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `Error saving integration details: ${err}`,
        'Error saving ClickUp details'
      );
    }

    // Commit updates
    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        `Error committing database updates: ${err}`,
        'System error'
      );
    }

    // Return JSON-API public details
    res.status(201).send({
      data: {
        id: 'clickup',
        type: 'integration',
        attributes: integrationDetails,
      },
    });

    // Avoid notifications in incognito mode
    if (incognitoMode) {
      return;
    }

    // Send global notification for ClickUp integration
    try {
      await notificationsModel.addRecord(db, {
        title: 'ClickUp Integration Added',
        summary: notifyTemplate('clickup-integration-added-summary', {
          workspaceName: selectedWorkspace.name,
          authorName,
        }),
        markdownBody: notifyTemplate(
          'clickup-integration-added-markdown-body',
          {
            workspaceName: selectedWorkspace.name,
            workspaceId: selectedWorkspace.id,
            authorName,
            authorEmail,
          }
        ),
        creator: authorId,
      });
      log.info(
        `${PREFIX} ClickUp Integration Added global notification successfully created`
      );
    } catch (err) {
      log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
    }
  };
};
