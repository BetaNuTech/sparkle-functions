const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: push-messages:';

module.exports = modelSetup({
  /**
   * Insert a `sendMessage` record in Firebase instance
   * @param  {String} title
   * @param  {String} message
   * @param  {String} recipientId
   * @param  {Number} createdAt   UNIX timestamp
   * @return {Promise} - resolves {Object} {id, message}
   */
  createSendMessage(db, { title, message, recipientId, createdAt }) {
    assert(Boolean(db), 'has Firebase Admin database instance');
    assert(title && typeof title === 'string', 'has record title string');
    assert(message && typeof message === 'string', 'has record message string');
    assert(
      recipientId && typeof recipientId === 'string',
      'has message recipientId'
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
        .then(msg => resolve({ id: msg.key, message: msg }))
        .catch(err => reject(Error(`${PREFIX}: create-send-message: ${err}`)));
    });
  },
});
