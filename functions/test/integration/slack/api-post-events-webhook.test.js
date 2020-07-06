const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const postEventsWebhook = require('../../../slack/api/post-events-webhook');

describe('Slack | API | POST Events Webhooks', () => {
  afterEach(() => sinon.restore());

  it('responds to Slack challenge request', done => {
    const expected = 'test-challenge';

    // Stub integrations
    request(createApp())
      .post('/t')
      .send({
        type: 'url_verification',
        challenge: expected,
      })
      .expect(200)
      .then(res => {
        const actual = res.body.challenge;
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('disregards request for Slack team not authorized by system', done => {
    const expected = false;

    // Stub integrations
    sinon.stub(integrationsModel, 'isAuthorizedSlackTeam').resolves(false);
    const removeCredentials = sinon
      .stub(systemModel, 'firestoreRemoveSlack')
      .resolves();

    request(createApp())
      .post('/t')
      .send({ team_id: '1', event: { type: 'app_uninstalled' } })
      .expect(200)
      .then(() => {
        const actual = removeCredentials.called;
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('removes all slack records on uninstall event', done => {
    sinon.stub(integrationsModel, 'isAuthorizedSlackTeam').resolves(true);
    sinon
      .stub(systemModel, 'firestoreFindSlack')
      .resolves(stubSlackCredentials());
    const removeCredentials = sinon
      .stub(systemModel, 'firestoreRemoveSlack')
      .resolves();
    const removeIntegration = sinon
      .stub(integrationsModel, 'firestoreRemoveSlack')
      .resolves();
    const removeNotifications = sinon
      .stub(notificationsModel, 'firestoreRemoveAllSlack')
      .resolves();

    request(createApp())
      .post('/t')
      .send({ team_id: '1', event: { type: 'app_uninstalled' } })
      .expect(200)
      .then(() => {
        expect(removeCredentials.called).to.equal(
          true,
          'removed system Slack credentials'
        );
        expect(removeIntegration.called).to.equal(
          true,
          'removed integration details'
        );
        expect(removeNotifications.called).to.equal(
          true,
          'removed slack notifications'
        );
        return done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t',
    bodyParser.json(),
    postEventsWebhook({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
    })
  );
  return app;
}

function stubSlackCredentials(config = {}) {
  return {
    data: () => ({ accessToken: '123', ...config }),
  };
}
