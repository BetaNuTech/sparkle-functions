const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const handler = require('../../../properties/api/get-property-yardi-custom-values');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');

const PROPERTY = { code: 'prop' };

describe("Properties | API | GET Property's Yardi Custom Values", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(403);

    expect(result.body.errors[0].detail).to.equal(
      'Organization not configured for Yardi'
    );
  });

  it('returns a helpful error when Yardi credentials rejected', async () => {
    stubIntegration();
    const err = Error('bad credentials');
    err.code = 'ERR_BAD_YARDI_CREDENTIALS';
    sinon.stub(yardi, 'getYardiCustomValues').rejects(err);

    const result = await request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(407);

    expect(result.body.errors[0].detail).to.contain('credentials not accepted');
  });

  it('returns a helpful error when Yardi request fails', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiCustomValues').rejects(Error('request timeout'));

    const result = await request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(500);

    expect(result.body.errors[0].detail).to.contain(
      'Unexpected error fetching Yardi values'
    );
  });

  it('passes the organization yardi configuration to the lookup', async () => {
    const yardiConfig = { userName: 'user', entity: 'Sparkle' };
    sinon
      .stub(systemModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', yardiConfig));
    sinon
      .stub(integrationModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    const lookup = sinon
      .stub(yardi, 'getYardiCustomValues')
      .resolves(createCustomValues());

    await request(createApp())
      .get('/t/123')
      .send()
      .expect(200);

    expect(lookup.firstCall.args[0]).to.deep.equal(yardiConfig);
  });

  it('returns the custom values as a JSON/API formatted record', async () => {
    stubIntegration();
    const customValues = createCustomValues();
    sinon.stub(yardi, 'getYardiCustomValues').resolves({ ...customValues });

    const result = await request(createApp())
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(200);

    expect(result.body).to.deep.equal({
      data: {
        id: PROPERTY.code,
        type: 'yardi-custom-values',
        attributes: customValues,
      },
    });
  });
});

function stubIntegration() {
  sinon
    .stub(systemModel, 'findYardi')
    .resolves(firebase.createDocSnapshot('yardi', {}));
  sinon
    .stub(integrationModel, 'findYardi')
    .resolves(firebase.createDocSnapshot('yardi', {}));
}

function createApp() {
  const app = express();
  app.get(
    '/t/:propertyId',
    stubAuth,
    stubPropertyCode,
    yardiMiddleware({ collection: () => ({}) }),
    handler()
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function stubPropertyCode(req, res, next) {
  req.property = PROPERTY;
  next();
}

function createCustomValues() {
  return {
    priorities: ['High', 'Low'],
    categories: [{ name: 'Plumbing', subCategories: ['Drains'] }],
    statuses: [
      { name: 'Call', type: 'standard' },
      { name: 'Parts Ordered', type: 'custom' },
    ],
    reasons: [{ status: 'On Hold', reason: 'Duplicate', required: true }],
    resolutions: [],
  };
}
