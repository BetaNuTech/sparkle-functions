const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const handler = require('../../../properties/api/patch-property-yardi-work-order');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');

const PROPERTY = { code: 'prop' };
const EXISTING = {
  id: '531772',
  unit: '101',
  resident: 't0001',
  status: 'call',
  priority: 'low',
};

describe("Properties | API | PATCH Property's Yardi Work Order", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ status: 'Scheduled' })
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
      .patch('/t/123/abc')
      .send({ status: 'Scheduled' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
    expect(lookup.called).to.equal(false);
  });

  it('rejects changing the work order id', async () => {
    stubIntegration();
    const update = sinon.stub(yardi, 'createOrEditYardiWorkOrder');

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ id: '1' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('id');
    expect(update.called).to.equal(false);
  });

  it('rejects an empty update', async () => {
    stubIntegration();
    const update = sinon.stub(yardi, 'createOrEditYardiWorkOrder');

    await request(createApp())
      .patch('/t/123/531772')
      .send({})
      .expect('Content-Type', /json/)
      .expect(400);

    expect(update.called).to.equal(false);
  });

  it('rejects invalid update attributes', async () => {
    stubIntegration();
    const update = sinon.stub(yardi, 'createOrEditYardiWorkOrder');

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ reason: 'x'.repeat(101) })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('reason');
    expect(update.called).to.equal(false);
  });

  it('returns not found and does not edit when the work order does not exist', async () => {
    stubIntegration();
    const notFound = Error('not found');
    notFound.code = 'ERR_NO_YARDI_WORK_ORDER';
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').rejects(notFound);
    const update = sinon.stub(yardi, 'createOrEditYardiWorkOrder');

    const result = await request(createApp())
      .patch('/t/123/999')
      .send({ status: 'Scheduled' })
      .expect('Content-Type', /json/)
      .expect(404);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
    expect(update.called).to.equal(false);
  });

  it('returns a helpful error when Yardi credentials rejected', async () => {
    stubIntegration();
    const err = Error('bad credentials');
    err.code = 'ERR_BAD_YARDI_CREDENTIALS';
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').rejects(err);

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ status: 'Scheduled' })
      .expect('Content-Type', /json/)
      .expect(407);

    expect(result.body.errors[0].detail).to.contain('credentials not accepted');
  });

  it('returns a helpful error when Yardi rejects the update', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').resolves({ ...EXISTING });
    const rejected = Error('rejected');
    rejected.code = 'ERR_YARDI_WORK_ORDER_REJECTED';
    rejected.details = ['Could not find Priority:Urgent'];
    sinon.stub(yardi, 'createOrEditYardiWorkOrder').rejects(rejected);

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ priority: 'Urgent' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].detail).to.equal(
      'Could not find Priority:Urgent'
    );
  });

  it('returns a helpful error when Yardi request fails', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').resolves({ ...EXISTING });
    sinon
      .stub(yardi, 'createOrEditYardiWorkOrder')
      .rejects(Error('request timeout'));

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ status: 'Scheduled' })
      .expect('Content-Type', /json/)
      .expect(500);

    expect(result.body.errors[0].detail).to.contain(
      'Unexpected error updating work order'
    );
  });

  it('sends the id, existing unit, and updates to Yardi', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').resolves({ ...EXISTING });
    const update = sinon
      .stub(yardi, 'createOrEditYardiWorkOrder')
      .resolves({ ...EXISTING, status: 'scheduled' });

    await request(createApp())
      .patch('/t/123/531772')
      .send({ status: 'Scheduled', technicianNotes: 'notes' })
      .expect(200);

    const [propertyCode, , sent] = update.firstCall.args;
    expect(propertyCode).to.equal(PROPERTY.code);
    expect(sent).to.deep.equal({
      id: '531772',
      unit: '101',
      status: 'Scheduled',
      technicianNotes: 'notes',
    });
  });

  it('allows the unit to be changed by the update', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').resolves({ ...EXISTING });
    const update = sinon
      .stub(yardi, 'createOrEditYardiWorkOrder')
      .resolves({ ...EXISTING, unit: '202' });

    await request(createApp())
      .patch('/t/123/531772')
      .send({ unit: '202' })
      .expect(200);

    expect(update.firstCall.args[2].unit).to.equal('202');
  });

  it('returns the updated work order as a JSON/API formatted record', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiPropertyWorkOrder').resolves({ ...EXISTING });
    sinon
      .stub(yardi, 'createOrEditYardiWorkOrder')
      .resolves({ ...EXISTING, status: 'scheduled' });

    const result = await request(createApp())
      .patch('/t/123/531772')
      .send({ status: 'Scheduled' })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(result.body).to.deep.equal({
      data: {
        id: '531772',
        type: 'work-order',
        attributes: { unit: '101', status: 'scheduled', priority: 'low' },
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
  app.patch(
    '/t/:propertyId/:workOrderId',
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
