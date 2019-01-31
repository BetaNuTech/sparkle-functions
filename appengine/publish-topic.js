const assert = require('assert');

const PROJECT_ID = `${process.env.GOOGLE_CLOUD_PROJECT || 'Unknown Cloud Project'}`;

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
      const [topics] = await client.getTopics();
      const hasCreatedTopic = topics.map(({name}) => name.split('/').pop()).includes(target);

      if (!hasCreatedTopic) {
        console.log(`${PROJECT_ID}: creating topic ${target}`);
        await client.createTopic(target);
      }

      await client.topic(target)
          .publisher()
          .publish(Buffer.from('msg'));

      res.status(200).send(`Published to ${target}`).end();
    } catch (e) {
      console.error(e);
      console.log(`${PROJECT_ID}: failed to publish topic ${target}`);
      res.status(500).send(`${e}`).end();
    }
  }
};
