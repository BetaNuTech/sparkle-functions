const assert = require('assert');
const log = require('../../utils/logger');
const trello = require('../../services/trello');
const systemModel = require('../../models/system');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const integrationsModel = require('../../models/integrations');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'trello: api: post-auth:';

/**
 * Factory for trello token upsert endpoint
 * @param  {admin.firestore} db - Firestore DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPostTrelloAuth(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Write /trelloTokens to integration/trello
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, body } = req;
    const apiKey = (body || {}).apikey || '';
    const authToken = (body || {}).authToken || '';
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

    // Reject invalid request
    if (!apiKey || !authToken) {
      let message = 'Trello Token Handler requires:';

      if (!apiKey) {
        message += ' apikey';
      }

      if (!authToken) {
        message += ' authToken';
      }

      return res.status(400).send({
        errors: [{ detail: message }],
      });
    }

    // Recover Trello Member ID
    let memberId = '';
    try {
      const responseBody = await trello.fetchToken(authToken, apiKey);
      memberId = responseBody.idMember;
    } catch (err) {
      log.error(`${PREFIX} Error retrieving trello token: ${err}`);
      return res.status(401).send({
        errors: [{ detail: 'trello token request not authorized' }],
      });
    }

    // Recover Trello username
    let trelloUsername = '';
    let trelloEmail = '';
    let trelloFullName = '';
    try {
      const responseBody = await trello.fetchMemberRecord(
        memberId,
        authToken,
        apiKey
      );
      trelloUsername = responseBody.username;
      trelloEmail = responseBody.email || ''; // optional
      trelloFullName = responseBody.fullName || ''; // optional
    } catch (err) {
      log.error(`${PREFIX} Error retrieving trello member: ${err}`);
      return res.status(401).send({
        errors: [{ detail: 'trello member request not authorized' }],
      });
    }

    const batch = db.batch();

    // Persist Trello credentials to system DB
    try {
      await systemModel.upsertTrello(
        db,
        {
          authToken,
          apikey: apiKey,
          user: user.id,
        },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `Error saving trello system credentials: ${err}`,
        'Error saving trello credentials'
      );
    }

    // Persist Trello integration details for clients
    let integrationDetails = null;
    try {
      integrationDetails = await integrationsModel.upsertTrello(
        db,
        {
          member: memberId,
          trelloUsername,
          trelloEmail,
          trelloFullName,
        },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `Error saving integration details: ${err}`,
        'Error saving trello details'
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
        id: 'trello',
        type: 'integration',
        attributes: integrationDetails,
      },
    });

    // Avoid notifications in incognito mode
    if (incognitoMode) {
      return;
    }

    // Send global notification for updated Slack system channel
    try {
      await notificationsModel.addRecord(db, {
        title: 'Trello Integration Added',
        summary: notifyTemplate('trello-integration-added-summary', {
          name: trelloFullName,
          username: trelloUsername,
          authorName,
        }),
        markdownBody: notifyTemplate('trello-integration-added-markdown-body', {
          name: trelloFullName,
          username: trelloUsername,
          authorName,
          authorEmail,
        }),
        creator: authorId,
      });
      log.info(
        `${PREFIX} Trello Integration Added global notification successfully created`
      );
    } catch (err) {
      log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
    }
  };
};
