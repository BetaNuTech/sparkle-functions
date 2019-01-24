const co = require('co');
const log = require('../utils/logger');

const LOG_PREFIX = 'push-messages:';

module.exports = {
  /**
   * Clean any lingering /push-messages from database
   * when pubsub client receives a message
   * @param  {String} topic
   * @param  {functions.pubsub} pubSub
   * @param  {firebaseAdmin.database} db
   * @return {functions.CloudFunction}
   */
  createPublishHandler(topic = '', pubSub, db) {
    const logPrefix = `${LOG_PREFIX} onPublish: ${topic}:`;
    return pubSub
      .topic(topic)
      .onPublish(() => co(function *() {
        const updates = {};
        log.info(`${logPrefix} received ${Date.now()}`);

        const snapShot = yield db.ref('/sendMessages').child().once('value')

        // No messages in database
        if (!snapShot.exists()) {
          return updates;
        }

        // Trigger `onWrite` for all lingering messages
        const messageIds = snapShot.hasChildren() ? Object.keys(snapShot.toJSON()) : [snapShot.key];

        messageIds.filter(Boolean).forEach((id) => {
          updates[id] = true;
          log.info(`${logPrefix} triggering message ${id} onWrite`);
        });

        return updates;
      }));
  }
};
