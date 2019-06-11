const assert = require('assert');

const LOG_PREFIX = 'push-messages: create-send-message:';

/**
 * Insert a `sendMessage` record in Firebase instance
 * @param  {String} title
 * @param  {String} message
 * @param  {String} recipientId
 * @param  {Number} createdAt   UNIX timestamp
 * @return {Promise} - resolves {Object} {id, message}
 */
module.exports = function createSendMessage(
  db,
  { title, message, recipientId, createdAt }
) {
  assert(Boolean(db), `${LOG_PREFIX} has Firebase Admin database instance`);
  assert(
    title && typeof title === 'string',
    `${LOG_PREFIX} has record title string`
  );
  assert(
    message && typeof message === 'string',
    `${LOG_PREFIX} has record message string`
  );
  assert(
    recipientId && typeof recipientId === 'string',
    `${LOG_PREFIX} has message recipientId`
  );

  if (createdAt instanceof Date) {
    createdAt = createdAt.getTime();
  } else if (typeof createdAt !== 'number') {
    createdAt = Date.now() / 1000; // UNIX timestamp
  }

  return new Promise((resolve, reject) => {
    db.ref('sendMessages')
      .push({
        createdAt,
        recipientId,
        title,
        message,
      })
      .then(message => resolve({ id: message.key, message }), reject);
  });
};
