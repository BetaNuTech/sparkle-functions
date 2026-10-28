const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const handler = require('../../../properties/api/post-property-yardi-work-order');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');

const PROPERTY = { code: 'prop' };

describe("Properties | API | POST Property's Yardi Work Order", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: '101' })
      .expect('Content-Type', /json/)
      .expect(403);

    expect(result.body.errors[0].detail).to.equal(
      'Organization not configured for Yardi'
    );
  });

  it('rejects a work order id, which would edit instead of create', async () => {
    stubIntegration();
    const create = sinon.stub(yardi, 'createOrEditYardiWorkOrder');

    const result = await request(createApp())
      .post('/t/123')
      .send({ id: '531772', unit: '101' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('id');
    expect(create.called).to.equal(false);
  });

  it('rejects an invalid work order payload', async () => {
    stubIntegration();
    const create = sinon.stub(yardi, 'createOrEditYardiWorkOrder');

    const result = await request(createApp())
      .post('/t/123')
      .send({ briefDescription: 'x'.repeat(36), bogus: true })
      .expect('Content-Type', /json/)
      .expect(400);

    const pointers = result.body.errors.map(({ source }) => source.pointer);
    expect(pointers).to.include('unit');
    expect(pointers).to.include('briefDescription');
    expect(pointers).to.include('bogus');
    expect(create.called).to.equal(false);
  });

  it('returns a helpful error when Yardi rejects the work order', async () => {
    stubIntegration();
    const rejected = Error('rejected');
    rejected.code = 'ERR_YARDI_WORK_ORDER_REJECTED';
    rejected.details = [
      'Could not find Unit:ZZ in Property:prop',
      'Could not find Priority:Urgent',
    ];
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').rejects(rejected);

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: 'ZZ', priority: 'Urgent' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors.map(({ detail }) => detail)).to.deep.equal(
      rejected.details
    );
  });

  it('returns a helpful error when Yardi rejected property code', async () => {
    stubIntegration();
    const err = Error('bad code');
    err.code = 'ERR_NO_YARDI_PROPERTY';
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').rejects(err);

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: '101' })
      .expect('Content-Type', /json/)
      .expect(404);

    expect(result.body.errors[0].detail).to.contain('yardi code for property');
  });

  it('returns a helpful error when the property is not configured for the Yardi interface', async () => {
    stubIntegration();
    const err = Error('not configured');
    err.code = 'ERR_YARDI_PROPERTY_NOT_CONFIGURED';
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').rejects(err);

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: '101' })
      .expect('Content-Type', /json/)
      .expect(403);

    expect(result.body.errors[0].source.pointer).to.equal('code');
    expect(result.body.errors[0].detail).to.contain(
      'not configured for this property'
    );
  });

  it('returns a helpful error when Yardi credentials rejected', async () => {
    stubIntegration();
    const err = Error('bad credentials');
    err.code = 'ERR_BAD_YARDI_CREDENTIALS';
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').rejects(err);

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: '101' })
      .expect('Content-Type', /json/)
      .expect(407);

    expect(result.body.errors[0].detail).to.contain('credentials not accepted');
  });

  it('returns a bad gateway error when Yardi cannot read the request', async () => {
    stubIntegration();
    const err = Error('fault');
    err.code = 'ERR_YARDI_SOAP_FAULT';
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').rejects(err);

    await request(createApp())
      .post('/t/123')
      .send({ unit: '101' })
      .expect('Content-Type', /json/)
      .expect(502);
  });

  it('returns a helpful error when Yardi request fails', async () => {
    stubIntegration();
    sinon
      .stub(yardi, 'createOrEditYardiWorkOrder')
      .rejects(Error('request timeout'));

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: '101' })
      .expect('Content-Type', /json/)
      .expect(500);

    expect(result.body.errors[0].detail).to.contain(
      'Unexpected error creating work order'
    );
  });

  it('sends the property code and work order to Yardi', async () => {
    stubIntegration();
    const workOrder = {
      unit: '101',
      briefDescription: 'brief',
      status: 'Call',
    };
    const create = sinon
      .stub(yardi, 'createOrEditYardiWorkOrder')
      .resolves({ id: '1', ...workOrder });

    await request(createApp())
      .post('/t/123')
      .send(workOrder)
      .expect(201);

    const [propertyCode, , sent] = create.firstCall.args;
    expect(propertyCode).to.equal(PROPERTY.code);
    expect(sent).to.deep.equal(workOrder);
  });

  it('returns the created work order as a JSON/API formatted record', async () => {
    stubIntegration();
    const created = {
      id: '531772',
      unit: '101',
      resident: 't0001',
      status: 'call',
      priority: 'low',
      briefDescription: 'brief',
    };
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').resolves({ ...created });

    const result = await request(createApp())
      .post('/t/123')
      .send({ unit: '101', resident: 't0001', briefDescription: 'brief' })
      .expect('Content-Type', /json/)
      .expect(201);

    expect(result.body).to.deep.equal({
      data: {
        id: '531772',
        type: 'work-order',
        attributes: {
          unit: '101',
          status: 'call',
          priority: 'low',
          briefDescription: 'brief',
        },
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
  app.post(
    '/t/:propertyId',
    bodyParser.json(),
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
