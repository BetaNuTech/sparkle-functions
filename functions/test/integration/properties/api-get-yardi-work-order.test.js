const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const handler = require('../../../properties/api/get-property-yardi-work-order');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');

const PROPERTY = { code: 'prop' };

describe("Properties | API | GET Property's Yardi Work Order", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp())
      .get('/t/123/531772')
      .send()
      .expect('Content-Type', /json/)
      .expect(403);

    expect(result.body.errors[0].detail).to.equal(
      'Organization not configured for Yardi'
    );
  });

  it('rejects a non-numeric work order id', async () => {
    stubIntegration();
    const lookup = sinon.stub(yardi, 'getYardiPropertyWorkOrder');

    const result = await request(createApp())
      .get('/t/123/abc')
      .send()
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
    expect(lookup.called).to.equal(false);
  });

  it('returns not found for an unknown work order', async () => {
    stubIntegration();
    const notFound = Error('not found');
    notFound.code = 'ERR_NO_YARDI_WORK_ORDER';
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').rejects(notFound);

    const result = await request(createApp())
      .get('/t/123/999')
      .send()
      .expect('Content-Type', /json/)
      .expect(404);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
  });

  it('returns a helpful error when Yardi credentials rejected', async () => {
    stubIntegration();
    const err = Error('bad credentials');
    err.code = 'ERR_BAD_YARDI_CREDENTIALS';
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').rejects(err);

    const result = await request(createApp())
      .get('/t/123/531772')
      .send()
      .expect('Content-Type', /json/)
      .expect(407);

    expect(result.body.errors[0].detail).to.contain('credentials not accepted');
  });

  it('returns a helpful error when Yardi request fails', async () => {
    stubIntegration();
    sinon
      .stub(yardi, 'getYardiPropertyWorkOrder')
      .rejects(Error('request timeout'));

    const result = await request(createApp())
      .get('/t/123/531772')
      .send()
      .expect('Content-Type', /json/)
      .expect(500);

    expect(result.body.errors[0].detail).to.contain(
      'Unexpected error fetching work order'
    );
  });

  it('requests the work order for the property by id', async () => {
    stubIntegration();
    const lookup = sinon
      .stub(yardi, 'getYardiPropertyWorkOrder')
      .resolves({ id: '531772', unit: '101' });

    await request(createApp())
      .get('/t/123/531772')
      .send()
      .expect(200);

    const [propertyCode, , workOrderId] = lookup.firstCall.args;
    expect(propertyCode).to.equal(PROPERTY.code);
    expect(workOrderId).to.equal('531772');
  });

  it('returns the work order as a JSON/API formatted record', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').resolves({
      id: '531772',
      unit: '101',
      resident: 't0001',
      status: 'scheduled',
    });

    const result = await request(createApp())
      .get('/t/123/531772')
      .send()
      .expect('Content-Type', /json/)
      .expect(200);

    expect(result.body).to.deep.equal({
      data: {
        id: '531772',
        type: 'work-order',
        attributes: { unit: '101', status: 'scheduled' },
        relationships: {
          resident: { data: { id: 't0001', type: 'resident' } },
        },
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
    '/t/:propertyId/:workOrderId',
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
