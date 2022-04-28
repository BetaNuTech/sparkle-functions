const assert = require('assert');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const notificationsModel = require('../../models/notifications');
const integrationsModel = require('../../models/integrations');
const notifyTemplate = require('../../utils/src-notification-templates');

const PREFIX = 'slack: api: patch-auth:';

/**
 * Factory for updating slack integration details
 * @param  {admin.firestore} db
 * @return {Function} - request handler
 */
module.exports = function patchAuth(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const dbUpdates = {};
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);
    const updates = JSON.parse(JSON.stringify(body || {}));
    const hasUpdates =
      updates && typeof updates.defaultChannelName === 'string';

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`${PREFIX} Update slack authentication`);

    // Reject bad request payloa
    if (!hasUpdates) {
      log.error(`${PREFIX} missing body`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'body missing update object',
            detail: 'Bad Request: slack authorization update invalid',
          },
        ],
      });
    }

    // Cleanup Slack channel name
    dbUpdates.defaultChannelName = updates.defaultChannelName
      .replace(/#/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[`~!@#$%^&*()_|+=?;:'",.<>\{\}\[\]\\\/]/gi, '') // eslint-disable-line
      .slice(0, 80); // channel names limited to 80 chars

    // Lookup slack integration details
    let slackIntegration = null;
    try {
      const snapshot = await integrationsModel.findSlack(db);
      slackIntegration = snapshot.data() || null;
    } catch (err) {
      return send500Error(err, 'integration lookup failed', 'unexpected error');
    }

    // Slack not authorized yet
    if (!slackIntegration) {
      log.error(`${PREFIX} slack integration does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'slack' },
            title: 'Slack integration not found',
          },
        ],
      });
    }

    log.info(`${PREFIX} recovered slack integration successfully`);

    // Persist integration updates
    try {
      await integrationsModel.updateSlack(db, dbUpdates);
    } catch (err) {
      return send500Error(
        err,
        'Slack integration details update failed',
        'unexpected error'
      );
    }

    log.info(`${PREFIX} successfully updated slack integration details`);

    // Successful
    res.status(201).send({
      data: {
        id: 'slack',
        type: 'integration',
        attributes: dbUpdates,
      },
    });

    // Avoid notifications in incognito mode
    if (incognitoMode) {
      return;
    }

    // Send global notification for updated Slack system channel
    try {
      await notificationsModel.addRecord(db, {
        title: 'Slack App Update',
        summary: notifyTemplate('slack-system-channel-update-summary', {
          name: dbUpdates.defaultChannelName,
          authorName,
        }),
        markdownBody: notifyTemplate(
          'slack-system-channel-update-markdown-body',
          {
            name: dbUpdates.defaultChannelName,
            authorName,
            authorEmail,
          }
        ),
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
