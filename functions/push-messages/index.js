const co = require('co');
const log = require('../utils/logger');

const LOG_PREFIX = 'push-messages:';

module.exports = {
  /**
  * Clean any lingering /push-messages from database
  * when pubsub client receives a message
  * @param  {String} topic
  * @param  {functions.pubsub} pubSub
  * @param  {firebaseAdmin.database} db
  * @return {functions.CloudFunction}
  */
  createPublishHandler(topic = '', pubSub, db) {
    const logPrefix = `${LOG_PREFIX} onPublish: ${topic}:`;
    return pubSub
    .topic(topic)
    .onPublish(() => co(function *() {
      const updates = {};
      log.info(`${logPrefix} received ${Date.now()}`);

      const snapShot = yield db.ref('/sendMessages').once('value')

      // No messages in database
      if (!snapShot.exists()) {
        return updates;
      }

      // Collect all message ID's
      const messageIds = (
        snapShot.hasChildren() ? Object.keys(snapShot.toJSON()) : [snapShot.key]
      ).filter(Boolean); // ignore null's

      // Trigger `onWrite` for all lingering messages
      var id;
      for (var i = 0; i < messageIds.length; i++) {
        id = messageIds[i];
        updates[id] = true;

        try {
          const message = yield db.ref(`/sendMessages/${id}`).once('value');
          yield db.ref(`/sendMessages/${id}`).update(message.val());
          log.info(`${logPrefix} resent message ${id} successfully`);
        } catch (e) {
          log.error(`${logPrefix} resend message ${id} failed`, e);
        }
      }

      return updates;
    }));
  },

  /**
  * Send a given push notifcation message to a recipient ID
  * @param {firebaseAdmin.database} db
  * @param {firebaseAdmin.messaging} msg
  * @param {String} recipientId
  * @param {String} messageId
  * @param {Object} pushMessage
  * @return {Promise} - resolves {String[]} recipient's registration tokens
  */
  sendToRecipient(db, msg, recipientId, messageId, pushMessage = {}) {
    return co(function *() {
      var registrationTokens = [];
      const dataSnapshot = yield db.ref('/registrationTokens').child(recipientId).once('value');

      if (!dataSnapshot.exists()) {
        // Recipient has no tokens
        return registrationTokens;
      }

      // These registration tokens come from the client FCM SDKs.
      if (dataSnapshot.hasChildren()) {
        dataSnapshot.forEach((childSnapshot) => {
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
          icon: 'https://s3.us-east-2.amazonaws.com/sapphireinspections/assets/app_icon_192.png'
        }
      };

      // Set the message as high priority and have it expire after 24 hours.
      // var options = {
      //   priority: "high",
      //   timeToLive: 60 * 60 * 24
      // };

      // Send a message to the device corresponding to the provided
      // registration token with the provided options.
      try {
        const response = yield msg.sendToDevice(registrationTokens, payload, {});
        log.info(`Successfully sent message: ${response}`);
      } catch (e) {
        log.error(`Error sending message: ${e}`);
      }

      yield db.ref('/sendMessages').child(messageId).remove();
      return registrationTokens;
    });
  }
};
