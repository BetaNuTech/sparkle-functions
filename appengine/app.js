const express = require('express');
const PubSub = require('@google-cloud/pubsub');
const createPublishTopicHandler = require('./publish-topic');

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || '';

// Create a new PubSub client using the GOOGLE_CLOUD_PROJECT
// environment variable. This is automatically set to the correct
// value when running on AppEngine.
const pubsubClient = new PubSub({
  projectId: PROJECT_ID
});

const app = express();

// For any request to /public/{some_topic}, push a simple
// PubSub message to that topic.
app.get('/publish/:topic', createPublishTopicHandler(pubsubClient));

// Index page, just to make it easy to see if the app is working.
app.get('/', (req, res) => {
    res.status(200).send('[functions-cron]: Hello, world!').end();
});

// Start the server
const PORT = process.env.PORT || 6060;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
