const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: notifications:';
const SLACK_NOTIFICATION_PATH = '/notifications/slack';

module.exports = modelSetup({
  /**
   * Push a Slack notification to a
   * specified channel name resolving
   * DB reference to the new notification
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} channelName
   * @param  {Object} notification
   * @return {Promise} - resolves {db.Ref}
   */
  async pushToSlackChannel(db, channelName, notification = {}) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} pushToSlackChannel: has Slack channel name`
    );
    assert(
      notification && notification.title && notification.message,
      `${PREFIX} pushToSlackChannel: has valid notification`
    );

    const notificationRef = db
      .ref(`${SLACK_NOTIFICATION_PATH}/${channelName}`)
      .push();

    try {
      await notificationRef.set(notification);
    } catch (err) {
      throw Error(`${PREFIX} pushToSlackChannel: ${err}`); // wrap error
    }

    return notificationRef;
  },
});
