const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: notifications:';
const SRC_NOTIFICATION_PATH = '/notifications/src';
const SLACK_NOTIFICATION_PATH = '/notifications/slack';

module.exports = modelSetup({
  /**
   * Push a Slack notification to a
   * specified channel name resolving
   * DB reference to the new notification
   * TODO: Deprecate
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

  /**
   * Add a slack notification to a notification channel
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} channelName
   * @param  {String} notificationId
   * @param  {Object} notification
   * @return {Promise} - resolves {db.Ref}
   */
  addToSlackChannel(db, channelName, notificationId, notification = {}) {
    assert(
      channelName && typeof channelName === 'string',
      `${PREFIX} addToSlackChannel: has Slack channel name`
    );
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} addToSlackChannel: has notification ID`
    );
    assert(
      notification && notification.title && notification.message,
      `${PREFIX} addToSlackChannel: has valid notification`
    );

    const ref = db.ref(
      `${SLACK_NOTIFICATION_PATH}/${channelName}/${notificationId}`
    );

    return ref
      .set(notification)
      .then(() => ref)
      .catch(err =>
        Promise.reject(
          Error(`${PREFIX} addToSlackChannel | ${err}`) // wrap error
        )
      );
  },

  /**
   * Update a source notification's published mediums
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} notificationId
   * @param  {Object} update
   * @return {Promise}
   */
  updateSrcPublishedMediums(db, notificationId, update) {
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} updateSrcPublishedMediums: has notification ID`
    );
    assert(
      update && typeof update === 'object',
      `${PREFIX} updateSrcPublishedMediums: has published medium updates`
    );

    return db
      .ref(`${SRC_NOTIFICATION_PATH}/${notificationId}/publishedMediums`)
      .update(update)
      .catch(err =>
        Promise.reject(
          Error(`${PREFIX} updateSrcPublishedMediums | ${err}`) // wrap error
        )
      );
  },
});
