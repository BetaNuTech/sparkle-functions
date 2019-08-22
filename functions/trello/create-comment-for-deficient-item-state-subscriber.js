const log = require('../utils/logger');
const systemModel = require('../models/system');

const PREFIX = 'trello: create-comment-for-deficient-item-state-subscriber:';

/**
 * Append DI state updates as comments to previously created Trello cards
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function createCommentForDiStateSubscriber(
  topic = '',
  pubsub,
  db
) {
  return pubsub.topic(topic).onPublish(async message => {
    log.info(`${PREFIX} received ${parseInt(Date.now() / 1000, 10)}`);

    let propertyId = '';
    let deficientItemId = '';
    let deficientItemState = '';

    // Parse event message
    try {
      const path = message.data
        ? Buffer.from(message.data, 'base64').toString()
        : '';

      if (!path) {
        throw new Error(`topic: ${topic} received invalid message`);
      }

      [propertyId, deficientItemId, , deficientItemState] = path.split('/');
    } catch (err) {
      const msgErr = `${PREFIX} message error: ${err}`;
      log.error(msgErr);
      throw Error(msgErr);
    }
  });
};
