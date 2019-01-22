const assert = require('assert');

/**
 * Create a handler that publishes topics to a client
 * @param  {String} topicPrefix
 * @param  {PubSub} client - @google-cloud/pubsub client instance
 * @return {Function} - Express request handler
 */
module.exports = function createPublishTopicHandler(topicPrefix = '', client) {
  // Duck type the client object
  assert(client && typeof client.topic === 'function', 'has pubsub client');

  return async function(req, res) {
    const { topic }  = req.params;

    const target = `${topicPrefix}${topic}`;

    try {
      await client.topic(target)
          .publisher()
          .publish(Buffer.from('msg'));

      res.status(200).send(`Published to ${target}`).end();
    } catch (e) {
      res.status(500).send('' + e).end();
    }
  }
};
