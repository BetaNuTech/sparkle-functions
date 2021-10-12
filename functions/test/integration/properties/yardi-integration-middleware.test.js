const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const yardiIntegration = require('../../../properties/middleware/yardi-integration');

describe('Properties | Middleware | Yardi Integration', () => {
  afterEach(() => sinon.restore());

  it('rejects request when organization yardi configuration is not set', done => {
    // Stup requests
    sinon.stub(systemModel, 'findYardi').resolves(createEmptyDoc());

    request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(403)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'not configured for Yardi'
        );
        done();
      })
      .catch(done);
  });

  it('continues pipeline when yardi integration exists', done => {
    // Stup requests
    sinon.stub(systemModel, 'findYardi').resolves(
      createDoc({
        code: 'test',
      })
    );

    request(createApp())
      .get('/t/123')
      .send()
      .expect(200)
      .then(() => done())
      .catch(() => done());
  });
});

function createApp() {
  const app = express();
  app.get(
    '/t/:propertyId',
    yardiIntegration({ collection: () => {} }),
    (_, res) => res.status(200).send()
  );
  return app;
}

function createDoc(data = {}) {
  return { data: () => data, exists: true };
}

function createEmptyDoc() {
  return { data: () => null, exists: false };
}
