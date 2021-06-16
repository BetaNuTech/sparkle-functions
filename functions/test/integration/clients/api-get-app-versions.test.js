const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const integrationsModel = require('../../../models/integrations');
const getVersions = require('../../../clients/api/get-app-versions');

describe('Clients | API | GET App Versions', () => {
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

  it('returns a required ios version when set', done => {
    const expected = {
      ios: 'v2',
      required_ios_version: 'v0.1',
    };

    // Setup requests
    sinon.stub(integrationsModel, 'getClientApps').resolves({
      exists: true,
      docs: [
        {
          id: 'ios',
          data: () => ({ version: 'v2', requiredVersion: 'v0.1' }),
        },
      ],
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
  app.get('/t/versions', stubAuth, getVersions({}));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
