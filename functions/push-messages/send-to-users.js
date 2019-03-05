const co = require('co');
const assert = require('assert');
const sendToRecipient = require('./send-to-recipient');
const createSendMessage = require('./create-send-message');
const {fetchRecordIds} = require('../utils/firebase-admin');
const log = require('../utils/logger');

const {assign, keys} = Object;
const LOG_PREFIX = 'push-messages: send-to-users:';

/**
 * Create sendMessage firebase records for all users
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.messaging} messaging - Firebase Admin messaging service instance
 * @param  {String} property
 * @param  {String} title
 * @param  {String} message
 * @param  {String[]} excludes
 * @param  {Number} createdAt
 * @param  {Boolean} allowCorp
 * @return {Promise} - resolves {Object[]} messages
 */
module.exports = function sendToUsers({
  db,
  messaging,
  title,
  message,
  excludes = [],
  createdAt,
  allowCorp = false,
  property,
}) {
  assert(Boolean(db), `${LOG_PREFIX} has Firebase Admin database instance`);
  assert(Boolean(messaging), `${LOG_PREFIX} has Firebase Admin messaging instance`);
  assert(message && typeof message === 'string', `${LOG_PREFIX} is given a valid message string`);
  assert(title && typeof title === 'string', `${LOG_PREFIX} is given a valid title string`);
  assert(Array.isArray(excludes) && excludes.every(e => typeof e === 'string'), `${LOG_PREFIX} has array of excluded strings`);

  return co(function* () {
    // Request and flatten response hash to array
    let users = yield db.ref('/users').once('value');
    users = users.val();
    if (!users) return [];
    users = keys(users).map(id => assign({id}, users[id]));
    const recipients = getRecepients({users, property, excludes, allowCorp});

    let messages;

    try {
      // Create `/sendMessages/<recipient-id>` database records for recipients
      messages = yield Promise.all(recipients.map(recipientId => createSendMessage(db, {
        title,
        message,
        recipientId,
        createdAt
      })));
    } catch (e) {
      throw new Error(`${LOG_PREFIX} create-send-messages: ${e}`); // wrap error
    }

    // Collect results of sending push notifications
    try {
      const results = yield Promise.all(recipients.map(recipientId =>
        sendToRecipient(
          db,
          messaging,
          recipientId,
          {
            title,
            message
          }
        ).then((r) => r instanceof Error ? false : true) // failed : succeeded
      ));
    } catch (e) {
      throw new Error(`${LOG_PREFIX} send-to-recipient: ${e}`); // wrap error
    }

    try {
      // Cleanup sent messages
      // Allow unsent messages to linger to retry during push notification sync
      yield Promise.all(results.map((result, i) =>
        result === false || !messages[i] ?
          Promise.resolve() :
          db.ref(`/sendMessages/${messages[i].id}`).remove()
      ));
    } catch (e) {
      throw new Error(`${LOG_PREFIX} remove-send-messages: ${e}`); // wrap error
    }

    return messages;
  });
};

/**
 * Create an array of valid recepient ID's
 * @param  {Object[]} users
 * @param  {Array}    excludes
 * @param  {Boolean}  allowCorp
 * @param  {String}   property
 * @return {String[]}
 */
function getRecepients({
  users,
  excludes = [],
  allowCorp = false,
  property,
}) {
  return users.map((user) => {
    const {admin, corporate} = user;
    const properties = keys(user.properties || {});

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
};
