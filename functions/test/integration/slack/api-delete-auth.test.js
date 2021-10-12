const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const slackService = require('../../../services/slack');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const deleteSlackAuth = require('../../../slack/api/delete-auth');

describe('Slack | API | DELETE Slack Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when slack app is already authorized', done => {
    const expected = 'No Slack App authorized';

    sinon.stub(systemModel, 'findSlack').resolves({ data: () => undefined });

    request(createApp())
      .delete('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('requests to uninstall Slack app via Slack API with stored access token', done => {
    const expected = 'slack-token-test';

    sinon
      .stub(systemModel, 'findSlack')
      .resolves(stubSlackCredentials({ accessToken: expected }));

    let actual = '';
    sinon.stub(slackService, 'uninstallApp').callsFake(token => {
      actual = token;
      return Promise.reject(Error('fail'));
    });

    request(createApp())
      .delete('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('returns an empty success status when Slack authentication successfully deleted', done => {
    sinon.stub(systemModel, 'findSlack').resolves(stubSlackCredentials());
    sinon.stub(slackService, 'uninstallApp').resolves();
    sinon.stub(systemModel, 'removeSlack').resolves();
    sinon.stub(integrationsModel, 'removeSlack').resolves();
    sinon.stub(notificationsModel, 'removeAllSlack').resolves();

    request(createApp())
      .delete('/t')
      .send()
      .expect(204)
      .then(() => done())
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/t',
    bodyParser.json(),
    stubAuth,
    deleteSlackAuth({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function stubSlackCredentials(config = {}) {
  return {
    data: () => ({ accessToken: '123', ...config }),
  };
}
