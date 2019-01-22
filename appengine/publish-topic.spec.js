const request = require('supertest');
const express = require('express');
const { expect } = require('chai')
const createPublishTopicHandler = require('./publish-topic');

describe('GET /publish/:topic', function() {
  it('should successfully publish requested topic', function(done) {
    const expected = 'test-topic';
    const app = createApp('', stubPubSubClient((actual) => {
      expect(expected).to.equal(actual, 'has expected topic');
    }));
    request(app)
      .get(`/publish/${expected}`)
      .expect(200, done);
  });

  it('should add any configured prefix to a topic', function(done) {
    const prefix = 'prefix-';
    const topic = 'test-topic-2';
    const expected = `${prefix}${topic}`;
    const app = createApp(prefix, stubPubSubClient((actual) => {
      expect(expected).to.equal(actual, 'has topic with prefix');
    }));
    request(app)
      .get(`/publish/${topic}`)
      .expect(200, done);
  });

  it('should publish a message Buffer', function(done) {
    const app = createApp('', stubPubSubClient(
      () => {},
      (actual) => {
        expect(actual).to.be.an.instanceof(Buffer, 'has a Buffer instance as message');
      }
    ));
    request(app)
      .get('/publish/test')
      .expect(200, done);
  });
});

function createApp(...pubTopicArgs) {
  const app = express();
  app.get('/publish/:topic', createPublishTopicHandler(...pubTopicArgs));
  return app;
}

function stubPubSubClient(topicTest = () => {}, pubTest = () => {}) {
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
    }
  };
}
