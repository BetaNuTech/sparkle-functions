const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: notifications:';
const SRC_NOTIFICATION_PATH = '/notifications/src';
const SLACK_NOTIFICATION_PATH = '/notifications/slack';
const PUSH_NOTIFICATION_PATH = '/notifications/push';

module.exports = modelSetup({
  /**
   * Find all source notifications
   * @param  {firebase.database} db
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAllSrc(db) {
    return db.ref(SRC_NOTIFICATION_PATH).once('value');
  },

  /**
   * Remove a source notification
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} notificationId
   * @return {Promise}
   */
  removeSrc(db, notificationId) {
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} removeSrc: has notification ID`
    );
    return db.ref(`${SRC_NOTIFICATION_PATH}/${notificationId}`).remove();
  },

  /**
   * Create a new source notification
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {Object} notification
   * @return {Promise}
   */
  createSrc(db, notification) {
    assert(
      notification && typeof notification === 'object',
      'has notification configuration'
    );

    const { title, summary, creator } = notification;
    assert(title && typeof title === 'string', 'has notification title');
    assert(summary && typeof summary === 'string', 'has notification summary');
    assert(typeof creator === 'string', 'has notification creator');

    const ref = db.ref(SRC_NOTIFICATION_PATH).push();
    return ref.set(notification);
  },

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
   * Atomically write a group of push
   * notifications to the the database
   * while marking the source notification'
   * published mediums for push
   * NOTE: /notifications/push/*
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} notificationId
   * @param  {Object[]} notifications
   * @return {Object} - result
   */
  createAllPush(db, notificationId, notifications) {
    assert(
      notificationId && typeof notificationId === 'string',
      `${PREFIX} createAllPush: has notification ID`
    );
    assert(
      Array.isArray(notifications) &&
        notifications.every(n => typeof n === 'object'),
      `${PREFIX} createAllPush: has notifications configs`
    );

    /**
     * @type {CreateAllPushResult}
     * @param {Object} publishedMediums
     */
    const result = { publishedMediums: { push: true } };
    const updates = Object.create(null);
    const parentRef = db.ref(PUSH_NOTIFICATION_PATH);

    notifications.forEach(notification => {
      const ref = parentRef.push();
      const path = ref.path.toString();

      // Append notification to updates
      updates[path] = notification;
    });

    // Append source published mediums
    updates[
      `${SRC_NOTIFICATION_PATH}/${notificationId}/publishedMediums/push`
    ] = true;

    // Write all
    return db
      .ref()
      .update(updates)
      .then(() => result);
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

  /**
   * Return all push notification records
   * @param  {firebaseAdmin.database} db firbase database
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAllPush(db) {
    return db.ref(PUSH_NOTIFICATION_PATH).once('value');
  },

  /**
   * Remove a push notification record
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} pushNotificationId
   * @return {Promise}
   */
  removePush(db, pushNotificationId) {
    assert(
      pushNotificationId && typeof pushNotificationId === 'string',
      `${PREFIX} removePush: has push notification ID`
    );
    return db.ref(`${PUSH_NOTIFICATION_PATH}/${pushNotificationId}`).remove();
  },

  /**
   * Find a user's registration tokens
   * @param  {firebaseAdmin.database} db firbase database
   * @param  {String} notificationId
   * @return {Promise} - resolves {DataSnapshot}
   */
  findUserRegistrationTokens(db, userId) {
    assert(
      userId && typeof userId === 'string',
      `${PREFIX} findUserRegistrationTokens: has user ID`
    );
    return db.ref(`/registrationTokens/${userId}`).once('value');
  },
});
