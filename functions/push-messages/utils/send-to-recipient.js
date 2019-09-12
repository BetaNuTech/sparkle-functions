const log = require('../../utils/logger');

const PREFIX = 'push-messages: utils: send-to-recipient:';

/**
 * Send a given push notifcation message to a recipient ID
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.messaging} messaging - Firebase Admin messaging service instance
 * @param {String} recipientId
 * @param {Object} pushMessage
 * @return {Promise} - resolves {String[]} recipient's registration tokens
 */
module.exports = async function sendToRecipient(
  db,
  messaging,
  recipientId,
  pushMessage = {}
) {
  const registrationTokens = [];
  const dataSnapshot = await db
    .ref(`/registrationTokens/${recipientId}`)
    .once('value');

  if (!dataSnapshot.exists()) {
    // Recipient has no tokens
    return registrationTokens;
  }

  // These registration tokens come from the client FCM SDKs.
  if (dataSnapshot.hasChildren()) {
    dataSnapshot.forEach(childSnapshot => {
      // key will be "ada" the first time and "alan" the second time
      // childData will be the actual contents of the child
      registrationTokens.push(childSnapshot.key);
    });
  } else {
    registrationTokens.push(dataSnapshot.key);
  }

  // See the "Defining the message payload" section above for details
  // on how to define a message payload.
  const payload = {
    notification: {
      title: pushMessage.title,
      body: pushMessage.message,
      icon:
        'https://s3.us-east-2.amazonaws.com/sapphireinspections/assets/app_icon_192.png',
    },
  };

  // Set the message as high priority and have it expire after 24 hours.
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
    log.info(`${PREFIX} successfully sent message: ${response.multicastId}`);
  } catch (err) {
    const errMsg = Error(`${PREFIX} Error sending message: ${err}`);
    log.error(errMsg.toString());
    throw errMsg;
  }

  return registrationTokens;
};
