const assert = require('assert');
const config = require('../../config');

const PUSH_NOTIFICATION_ICON = config.notifications.pushMessageIcon;

/**
 * FCM error codes meaning a registration
 * token will never work again and should
 * be removed from the user's tokens
 * @type {String[]}
 */
const INVALID_TOKEN_ERRORS = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

/**
 * Create an FCM HTTP v1 message
 * for a single registration token
 * @param  {String} token
 * @param  {String} title
 * @param  {String} body
 * @param  {Object?} data - string values only
 * @return {Object} - admin.messaging.Message
 */
function createMessage(token, title, body, data = {}) {
  return {
    token,
    notification: { title, body },
    data: stringifyValues(data),
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: { sound: 'default' },
      },
    },
    webpush: {
      notification: { icon: PUSH_NOTIFICATION_ICON },
    },
  };
}

/**
 * Publish a given push notifcation message
 * to all a user's registered device tokens
 * using the FCM HTTP v1 API, one message per
 * token so each token gets its own result
 * @param  {admin.messaging} messaging - Firebase Admin messaging service instance
 * @param  {String[]} regTokens
 * @param  {String} title
 * @param  {String} message
 * @param  {Object?} data - custom key/values sent with the message
 * @return {Promise} resolves {PushResult}
 */
async function publishPushMessage(messaging, regTokens, title, message, data) {
  assert(
    messaging && typeof messaging.send === 'function',
    'has messaging instance'
  );
  assert(
    regTokens && Array.isArray(regTokens) && regTokens.length,
    'has user registration tokens array'
  );
  assert(
    regTokens.every(token => token && typeof token === 'string'),
    'has array of user registration tokens'
  );
  assert(title && typeof title === 'string', 'push message has title');
  assert(message && typeof message === 'string', 'push message has message');

  const responses = await Promise.all(
    regTokens.map(token =>
      messaging.send(createMessage(token, title, message, data)).then(
        messageId => ({ success: true, messageId }),
        error => ({ success: false, error })
      )
    )
  );

  return createPushResult(regTokens, responses);
}

/**
 * Summarize FCM send responses
 * @param  {String[]} regTokens
 * @param  {Object[]} responses - in the same order as the tokens
 * @return {PushResult}
 */
function createPushResult(regTokens, responses) {
  /**
   * @typedef {Object} PushResult
   * @property {Number}   successCount
   * @property {Number}   failureCount
   * @property {String[]} messageIds - sent message IDs
   * @property {String[]} invalidTokens - tokens FCM will never accept again
   * @property {Error[]}  errors - all other (possibly temporary) failures
   */
  const result = {
    successCount: 0,
    failureCount: 0,
    messageIds: [],
    invalidTokens: [],
    errors: [],
  };

  responses.forEach((response, i) => {
    if (response.success) {
      result.successCount++;
      result.messageIds.push(response.messageId);
      return;
    }

    result.failureCount++;
    if (isInvalidTokenError(response.error)) {
      result.invalidTokens.push(regTokens[i]);
    } else {
      result.errors.push(response.error);
    }
  });

  return result;
}

/**
 * FCM rejected the token itself
 * rather than the message
 * @param  {Error?} error
 * @return {Boolean}
 */
function isInvalidTokenError(error) {
  const code = error && error.code;
  if (INVALID_TOKEN_ERRORS.includes(code)) {
    return true;
  }

  // HTTP v1 reports a malformed token as INVALID_ARGUMENT,
  // the same code as a bad payload, so check the message
  return (
    code === 'messaging/invalid-argument' &&
    /not a valid FCM registration token/i.test(`${error.message}`)
  );
}

/**
 * FCM data payloads only
 * accept string values
 * @param  {Object} data
 * @return {Object}
 */
function stringifyValues(data) {
  return Object.keys(data || {}).reduce((acc, key) => {
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = `${value}`;
    }
    return acc;
  }, {});
}

module.exports = publishPushMessage;
module.exports.createMessage = createMessage;
module.exports.createPushResult = createPushResult;
module.exports.INVALID_TOKEN_ERRORS = INVALID_TOKEN_ERRORS;
