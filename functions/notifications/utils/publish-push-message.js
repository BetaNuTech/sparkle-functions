const assert = require('assert');
const config = require('../../config');

const PREFIX = 'notifications: utils: publish-push-message:';
const PUSH_NOTIFICATION_ICON = config.notifications.pushMessageIcon;

/**
 * Publish a given push notifcation message
 * to all a user's registered device tokens
 * @param  {admin.messaging} messaging - Firebase Admin messaging service instance
 * @param  {String[]} regTokens
 * @param  {String} title
 * @param  {String} message
 * @return {Promise} resolves {String} push message ID
 */
module.exports = async function publishPushMessage(
  messaging,
  regTokens,
  title,
  message
) {
  assert(
    messaging && typeof messaging.sendToDevice === 'function',
    'has messaging instance'
  );
  assert(
    regTokens && Array.isArray(regTokens) && regTokens.length,
    'has user registration tokens array'
  );
  assert(
    regTokens.every(token => token && typeof token === 'string'),
    'has array of user registration tokens'
  );
  assert(title && typeof title === 'string', 'push message has title');
  assert(message && typeof message === 'string', 'push message has message');

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
  let multicastId = '';
  try {
    const response = await messaging.sendToDevice(regTokens, payload, {});
    multicastId = response.multicastId;
  } catch (err) {
    throw Error(`${PREFIX} failed publishing push message devices: ${err}`); // wrap error
  }

  return multicastId;
};
