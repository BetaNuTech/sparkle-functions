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
    return pubSub
      .topic(topic)
      .onPublish(() => {
        return Promise.resolve({});
      });
  }
};
