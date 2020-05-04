const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const integrationsModel = require('../../../models/integrations');
const getPropertyResidents = require('../../../versions/api/get-client-app-versions');

describe('Versions | API | GET Client App Versions', () => {
  afterEach(() => sinon.restore());

  it('returns a payload of all client app versions', done => {
    const expected = {
      web: 'v1',
      ios: 'v2',
    };

    // Setup requests
    sinon.stub(integrationsModel, 'getClientApps').resolves({
      exists: true,
      docs: Object.keys(expected).map(clientName => ({
        id: clientName,
        data: () => ({ version: expected[clientName] }),
      })),
    });

    request(createApp())
      .get('/t/versions')
      .send()
      .expect('Content-Type', /json/)
      .expect(200)
      .then(res => {
        const actual = res.body;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get('/t/versions', stubAuth, getPropertyResidents({}));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
