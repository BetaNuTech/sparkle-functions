const assert = require('assert');

/**
 * Insert a `/sendMessage` record in Firebase instance
 * @param  {firebaseAdmin.database} db
 * @param  {String} title
 * @param  {String} message
 * @param  {String} recipientId
 * @param  {Number} createdAt   UNIX timestamp
 * @return {Promise} - resolves {String} message id
 */
module.exports = function pushSendMessage(
  db,
  { title, message, recipientId, createdAt }
) {
  assert(Boolean(db), 'has firebase database instance');
  assert(title && typeof title === 'string', '`title` is a valid string');
  assert(message && typeof message === 'string', '`message` is a valid string');
  assert(
    recipientId && typeof recipientId === 'string',
    '`recipientId` is a valid string'
  ); // eslint-disable-line

  let unixCreatedAt;
  if (createdAt instanceof Date) {
    unixCreatedAt = createdAt.getTime() / 1000;
  } else if (!createdAt || typeof createdAt !== 'number') {
    unixCreatedAt = Date.now() / 1000;
  }

  return new Promise((resolve, reject) => {
    db.ref('sendMessages')
      .push({
        title,
        message,
        recipientId,
        createdAt: unixCreatedAt,
      })
      .then(msg => resolve(msg.key), reject);
  });
};
