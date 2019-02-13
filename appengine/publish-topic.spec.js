const request = require('supertest');
const express = require('express');
const { expect } = require('chai')
const createPublishTopicHandler = require('./publish-topic');

describe('GET /publish/:topic', function() {
  it('should create a topic if it does not exist', function(done) {
    const expected = 'test';
    const pubsub = stubPubSubClient(expected);
    pubsub.getTopics = () => ([[]]); // has no topics
    const originalCreateTopic = pubsub.createTopic;
    pubsub.createTopic = (actual) => {
      expect(actual).to.equal(expected);
      return originalCreateTopic(actual);
    }
    const app = createApp(pubsub);
    request(app)
      .get(`/publish/${expected}`)
      .expect(200, done);
  });

  it('should successfully publish requested topic', function(done) {
    const expected = 'test-topic';
    const app = createApp(stubPubSubClient(expected, (actual) => {
      expect(expected).to.equal(actual, 'has expected topic');
    }));
    request(app)
      .get(`/publish/${expected}`)
      .expect(200, done);
  });

  it('should publish a message Buffer', function(done) {
    const topic = 'test'
    const app = createApp(stubPubSubClient(
      topic,
      () => {},
      (actual) => {
        expect(actual).to.be.an.instanceof(Buffer, 'has a Buffer instance as message');
      }
    ));
    request(app)
      .get(`/publish/${topic}`)
      .expect(200, done);
  });
});

function createApp(...pubTopicArgs) {
  const app = express();
  app.get('/publish/:topic', createPublishTopicHandler(...pubTopicArgs));
  return app;
}

function stubPubSubClient(topicName = '', topicTest = () => {}, pubTest = () => {}) {
  return {
    topic: (topic) => {
      topicTest(topic);
      return {
        publisher: () => ({
          publish: (msg) => {
            pubTest(msg);
            return Promise.resolve()
          }
        })
      };
    },
    getTopics: () => ([[{ name: topicName }]]),
    createTopic: () => Promise.resolve()
  };
}
