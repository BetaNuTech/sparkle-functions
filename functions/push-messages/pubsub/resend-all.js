const log = require('../../utils/logger');
const sendToRecipient = require('../utils/send-to-recipient');

const PREFIX = 'push-messages: pubsub: resend-all';

/**
 * Clean any lingering /push-messages from database
 * when pubsub client receives a message
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @param {firebaseAdmin.messaging} messaging
 * @return {functions.CloudFunction}
 */
module.exports = function createResendAll(topic = '', pubSub, db, messaging) {
  return pubSub.topic(topic).onPublish(async () => {
    const updates = {};
    log.info(`${PREFIX}: ${topic}: received ${Math.round(Date.now() / 1000)}`);

    const snapShot = await db.ref('/sendMessages').once('value');

    // No messages in database
    if (!snapShot.exists()) {
      return updates;
    }

    // Collect all message ID's
    const messageIds = (snapShot.hasChildren()
      ? Object.keys(snapShot.toJSON())
      : [snapShot.key]
    ).filter(Boolean); // ignore null's

    // Trigger `onWrite` for all lingering messages
    let id;
    for (let i = 0; i < messageIds.length; i++) {
      id = messageIds[i];
      updates[id] = true;

      try {
        const path = `/sendMessages/${id}`;
        const message = await db.ref(path).once('value');
        const messageData = message.val();
        await sendToRecipient(
          db,
          messaging,
          messageData.recipientId,
          messageData
        );
        await db.ref(path).remove();
        log.info(`${PREFIX} ${topic}: resent message "${id}" successfully`);
      } catch (err) {
        log.error(`${PREFIX} ${topic}: resend message "${id}" failed | ${err}`);
      }
    }

    return updates;
  });
};
