const co = require('co');
const log = require('../utils/logger');
const sendToRecipient = require('./send-to-recipient');

/**
 * Clean any lingering /push-messages from database
 * when pubsub client receives a message
 * @param  {String} topic
 * @param  {functions.pubsub} pubSub
 * @param  {firebaseAdmin.database} db
 * @param {firebaseAdmin.messaging} messaging
 * @return {functions.CloudFunction}
 */
module.exports = function createCRONHandler(topic = '', pubSub, db, messaging) {
   const logPrefix = `push-messages: onPublish: ${topic}:`;
   return pubSub
   .topic(topic)
   .onPublish(() => co(function *() {
     const updates = {};
     log.info(`${logPrefix} received ${Date.now()}`);

     const snapShot = yield db.ref('/sendMessages').once('value');

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
         const path = `/sendMessages/${id}`;
         const message = yield db.ref(path).once('value');
         const messageData = message.val();
         yield sendToRecipient(
           db,
           messaging,
           messageData.recipientId,
           id,
           messageData
         );
         yield db.ref(path).remove();
         log.info(`${logPrefix} resent message ${id} successfully`);
       } catch (e) {
         log.error(`${logPrefix} resend message ${id} failed`, e);
       }
     }

     return updates;
   }));
 }
