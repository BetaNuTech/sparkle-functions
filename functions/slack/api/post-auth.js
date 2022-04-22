const assert = require('assert');
const slack = require('../../services/slack');
const systemModel = require('../../models/system');
const globalApi = require('../../services/global-api');
const { getFullName } = require('../../utils/user');
const integrationsModel = require('../../models/integrations');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const log = require('../../utils/logger');

const PREFIX = 'slack: api: post-auth:';

/**
 * Factory for creating a POST endpoint for
 * creating Slack authorization credentials
 * for the system
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPostAuth(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Write slack app auth to integration/slack
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, body = {} } = req;
    const { slackCode, redirectUri } = body;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set JSON API formatted response
    res.set('Content-Type', 'application/vnd.api+json');

    // Reject impropertly stuctured request body
    if (!slackCode || !redirectUri) {
      let message = 'Slack Auth Handler requires:';

      if (!slackCode) {
        message += ' slackCode';
        log.error(`${PREFIX} request body missing slackCode`);
      }

      if (!redirectUri) {
        message += ' redirectUri';
        log.error(`${PREFIX} request body missing redirectUri`);
      }

      return res.status(400).send({
        errors: [{ detail: message }],
      });
    }

    // Authorize user's credentials
    let slackResponse = null;
    try {
      slackResponse = await slack.authorizeCredentials(slackCode, redirectUri);
      if (!slackResponse.team) {
        throw Error('unexpected Slack response payload');
      }
      log.info(
        `${PREFIX} slack app authentication success for Slack team name: "${slackResponse
          .team.name || 'Unknown'}" by user: "${user.id}"`
      );
    } catch (err) {
      return send500Error(
        err,
        `error retrieved from Slack API: ${err}`,
        `Error from slack API: ${err}`
      );
    }

    // Publish Slack ID to Global API
    // for proxying Slack events
    try {
      await globalApi.updateSlackTeam(slackResponse.team.id);
      log.info(
        `${PREFIX} successfully authorized Slack app auth with Global API`
      );
    } catch (err) {
      return send500Error(
        err,
        `error retrieved from Global API: ${err}`,
        `Error from global API: ${err}`
      );
    }

    const batch = db.batch();

    try {
      // Set private credentials
      await systemModel.upsertSlack(
        db,
        {
          token: slackResponse.access_token,
          scope: slackResponse.scope,
        },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `${PREFIX} Error attempting to save system's slack credentials: ${err}`,
        'Unexpected error, please try again'
      );
    }

    let teamName = '';
    let integrationDetails = null;
    try {
      teamName = slackResponse.team.name;
      const integrationUpdate = {
        grantedBy: user.id,
        team: slackResponse.team.id,
        teamName,
      };

      // Add user's channel selected
      // during OAuth process
      if (
        slackResponse.incoming_webhook &&
        typeof slackResponse.incoming_webhook.channel === 'string'
      ) {
        // Remove any channel "#" prefix
        integrationUpdate.defaultChannelName = slackResponse.incoming_webhook.channel.replace(
          /^#/,
          ''
        );
      }

      // Set public integration details
      integrationDetails = await integrationsModel.setSlack(
        db,
        integrationUpdate,
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `${PREFIX} Error attempting to save integration details: ${err}`,
        'Unexpected error, please try again'
      );
    }

    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        `${PREFIX} Error committing batched updates: ${err}`,
        'Unexpected error, please try again'
      );
    }

    // Success
    res.status(201).send({
      data: {
        id: 'slack',
        type: 'integration',
        attributes: integrationDetails,
      },
    });

    // Avoid notifications in incognito mode
    if (incognitoMode) {
      return;
    }

    // Send global notification for added Slack auth
    try {
      await notificationsModel.addRecord(db, {
        title: 'Slack App Addition',
        summary: notifyTemplate('slack-integration-added-summary', {
          name: teamName,
          authorName,
        }),
        markdownBody: notifyTemplate('slack-integration-added-markdown-body', {
          name: teamName,
          authorName,
          authorEmail,
        }),
        creator: authorId,
      });
      log.info(
        `${PREFIX} Slack App Addition global notification successfully created`
      );
    } catch (err) {
      log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
    }
  };
};
