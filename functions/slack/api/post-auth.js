const assert = require('assert');
const slack = require('../../services/slack');
const systemModel = require('../../models/system');
const integrationsModel = require('../../models/integrations');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const log = require('../../utils/logger');

const PREFIX = 'slack: api: post-auth:';

/**
 * Factory for creating a POST endpoint for
 * creating Slack authorization credentials
 * for the system
 * @param  {firebase.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchProperty(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Write slack app auth to integration/slack
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, body = {} } = req;
    const { slackCode, redirectUri } = body;
    const send500Error = create500ErrHandler(PREFIX, res);

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
      log.info(
        `${PREFIX} slack app authentication success for Slack team name: "${slackResponse.team_name ||
          'Unknown'}" by user: "${user.id}"`
      );
    } catch (err) {
      return send500Error(
        err,
        `error retrieved from Slack API: ${err}`,
        `Error from slack API: ${err}`
      );
    }

    const batch = fs.batch();

    try {
      // Set private credentials
      await systemModel.firestoreUpsertSlack(
        fs,
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

    let integrationDetails = null;
    try {
      // Set public integration details
      integrationDetails = await integrationsModel.firestoreSetSlack(
        fs,
        {
          grantedBy: user.id,
          team: slackResponse.team_id,
          teamName: slackResponse.team_name,
        },
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
  };
};
