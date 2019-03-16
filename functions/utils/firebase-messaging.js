const assert = require('assert');

module.exports = {
  /**
   * Create an array of valid recepient ID's
   * @param  {Object[]} users
   * @param  {Array}    excludes
   * @param  {Boolean}  allowCorp
   * @param  {String}   property
   * @return {String[]}
   */
  getRecepients({
    users,
    excludes = [],
    allowCorp = false,
    property,
  }) {
    return users.map((user) => {
      const {admin, corporate} = user;
      const properties = Object.keys(user.properties || {});

      // Add all admins
      if (admin) {
        return user.id;

      // Add whitelisted corporate users
      } else if (allowCorp && corporate) {
        return user.id;

      // Add whitelisted user-group of specified property
      } else if (property && properties.includes(property)) {
        return user.id;
      }
    })
    // Remove falsey or excluded users
    .filter((id) => id && !excludes.includes(id));
  },

  /**
   * Insert a `/sendMessage` record in Firebase instance
   * @param  {firebaseAdmin.database} db
   * @param  {String} title
   * @param  {String} message
   * @param  {String} recipientId
   * @param  {Number} createdAt   UNIX timestamp
   * @return {Promise} - resolves {String} message id
   */
  pushSendMessage(db, {title, message, recipientId, createdAt}) {
    assert(Boolean(db), 'has firebase database instance');
    assert(title && typeof title === 'string', '`title` is a valid string');
    assert(message && typeof message === 'string', '`message` is a valid string');
    assert(recipientId && typeof recipientId === 'string', '`recipientId` is a valid string'); // eslint-disable-line

    let unixCreatedAt;
    if (createdAt instanceof Date) {
      unixCreatedAt = (createdAt.getTime() / 1000);
    } else if (!createdAt || typeof createdAt !== 'number') {
      unixCreatedAt = (Date.now() / 1000);
    }

    return new Promise((resolve, reject) => {
      db.ref('sendMessages').push({
        title,
        message,
        recipientId,
        createdAt: unixCreatedAt
      }).then(
        (message) => resolve(message.key),
        reject
      );
    });
  }
}
