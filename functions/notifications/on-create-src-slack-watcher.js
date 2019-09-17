const assert = require('assert');
const log = require('../utils/logger');

const PREFIX = 'notifications: on-create-src-watcher:';

/**
 * Factory for watcher to create Slack notifications
 * from a source notification in the database
 * NOTE: source notications `/notifications/src/*`
 * NOTE: slack notications `/notifications/slack/channel/*`
 * @param  {firebaseAdmin.database} database - Firebase Admin DB instance
 * @return {Function} - notifications source onCreate handler
 */
module.exports = function createOnCreateSrcSlackNotification(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const { notificationId } = event.params;
    const srcNotification = change.val();
    const {
      title,
      summary,
      // property: proeprtyId,
      // markdownBody,
    } = srcNotification;

    assert(Boolean(notificationId), 'has deficient item ID');
    assert(Boolean(srcNotification), 'has source notification');
    log.info(`${PREFIX} source notification "${notificationId}" generated`);

    // Reject invalid source notification
    if (!title) {
      throw Error(`${PREFIX} source notification has invalid title: ${title}`);
    } else if (!summary) {
      throw Error(
        `${PREFIX} source notification has invalid summary: ${summary}`
      );
    }
  };
};
