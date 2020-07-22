const assert = require('assert');
const log = require('../../utils/logger');
const config = require('../../config');
const notificationsModel = require('../../models/notifications');

const PREFIX = 'notifications: utils: push-to-users-devices:';
const PUSH_NOTIFICATION_ICON = config.notifications.pushMessageIcon;

/**
 * Publish a given push notifcation message
 * to all a user's registered device tokens
 * DEPRECATED: use ./publish-push-message instead
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.messaging} messaging - Firebase Admin messaging service instance
 * @param  {String} userId
 * @param  {Object} pushMessage
 * @return {Promise} - resolves {String[]} recipient's registration tokens
 */
module.exports = async function pushToUsersDevices(
  db,
  messaging,
  userId,
  pushMessage
) {
  assert(Boolean(db), 'has firebase admin database instance');
  assert(Boolean(messaging), 'has firebase messaging instance');
  assert(userId && typeof userId === 'string', 'has user ID');
  assert(pushMessage && typeof pushMessage === 'object', 'has push message');

  const { title, message } = pushMessage;
  assert(title && typeof title === 'string', 'push message has title');
  assert(message && typeof message === 'string', 'push message has message');

  const registrationTokens = [];

  try {
    const dataSnapshot = await notificationsModel.findUserRegistrationTokens(
      db,
      userId
    );

    if (!dataSnapshot.exists()) {
      // Recipient has no tokens
      return registrationTokens;
    }

    // Push all user's registration tokens
    // as push notification targets
    // NOTE: these registration tokens come from the client FCM SDKs.
    if (dataSnapshot.hasChildren()) {
      dataSnapshot.forEach(childSnapshot => {
        registrationTokens.push(childSnapshot.key);
      });
    } else {
      registrationTokens.push(dataSnapshot.key);
    }
  } catch (err) {
    throw Error(`${PREFIX} registration lookup failed | ${err}`); // wrap error
  }

  // See the "Defining the message payload" section
  // above for details on how to define a message payload.
  const payload = {
    notification: {
      title,
      body: message,
      icon: PUSH_NOTIFICATION_ICON,
    },
  };

  // Set the message as high priority and
  // have it expire after 24 hours.
  // var options = {
  //   priority: "high",
  //   timeToLive: 60 * 60 * 24
  // };

  // Send a message to the device corresponding to the provided
  // registration token with the provided options.
  try {
    const response = await messaging.sendToDevice(
      registrationTokens,
      payload,
      {}
    );
    log.info(`${PREFIX} successfully sent message: "${response.multicastId}"`);
  } catch (err) {
    throw Error(`${PREFIX} Firebase error sending to device | ${err}`); // wrap error
  }

  return registrationTokens;
};
