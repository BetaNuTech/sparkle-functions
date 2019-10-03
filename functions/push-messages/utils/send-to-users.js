const assert = require('assert');
const sendToRecipient = require('./send-to-recipient');
const modelPushMsgs = require('../../models/push-messages');
// const getRecepients = require('./get-recepients');

const { assign, keys } = Object;
const PREFIX = 'push-messages: utils: send-to-users:';

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
module.exports = async function sendToUsers({
  db,
  messaging,
  title,
  message,
  excludes = [],
  createdAt,
  allowCorp = false,
  property,
}) {
  assert(Boolean(db), `has Firebase Admin database instance`);
  assert(Boolean(messaging), 'has Firebase Admin messaging instance');
  assert(
    message && typeof message === 'string',
    'is given a valid message string'
  );
  assert(title && typeof title === 'string', 'is given a valid title string');
  assert(
    Array.isArray(excludes) && excludes.every(e => typeof e === 'string'),
    'has array of excluded strings'
  );

  // Request and flatten response hash to array
  let users = await db.ref('/users').once('value');
  users = users.val();
  if (!users) return [];
  users = keys(users).map(id => assign({ id }, users[id]));
  const recipients = [];
  // const recipients = getRecepients({
  //   users,
  //   property,
  //   excludes,
  //   allowCorp,
  // });

  let messages;

  try {
    // Create `/sendMessages/<recipient-id>` database records for recipients
    messages = await Promise.all(
      recipients.map(recipientId =>
        modelPushMsgs.createSendMessage(db, {
          title,
          message,
          recipientId,
          createdAt,
        })
      )
    );
  } catch (err) {
    throw Error(`${PREFIX} | ${err}`); // wrap error
  }

  let results = [];

  try {
    // Collect results of sending push notifications
    results = await Promise.all(
      recipients.map(
        recipientId =>
          sendToRecipient(db, messaging, recipientId, {
            title,
            message,
          }).then(r => !(r instanceof Error)) // failed : succeeded
      )
    );
  } catch (err) {
    throw Error(`${PREFIX} | ${err}`); // wrap error
  }

  try {
    // Cleanup sent messages
    // Allow unsent messages to linger to retry during push notification sync
    await Promise.all(
      results.map((result, i) =>
        result === false || !messages[i]
          ? Promise.resolve()
          : db.ref(`/sendMessages/${messages[i].id}`).remove()
      )
    );
  } catch (err) {
    throw Error(`${PREFIX} remove-send-messages: ${err}`); // wrap error
  }

  return messages;
};
