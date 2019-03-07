const co = require('co');
const sendToRecipient = require('./send-to-recipient');

/**
 * Factory for push message on write handler
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @param  {firebaseAdmin.messaging} - Firebase Admin messaging service instance
 * @return {Function} - push messages onWrite handler
 */
module.exports = function createPushMessagesOnWriteHandler(db, messaging) {
  return (change, event) => co(function *() {
    // Exit when the data is deleted.
    if (!change.after.exists()) {
        return false;
    }

    const pushMessage = change.after.val();
    const recipientId = pushMessage.recipientId;
    const messageId = event.params.objectId;

    yield sendToRecipient(
      db,
      messaging,
      recipientId,
      pushMessage
    );

    return db.ref(`/sendMessages/${messageId}`).remove();
  });
}
