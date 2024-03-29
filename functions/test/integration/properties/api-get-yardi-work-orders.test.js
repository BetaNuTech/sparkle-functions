const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const handler = require('../../../properties/api/get-property-yardi-work-orders');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');

describe("Properties | API | GET Property's Yardi Work Orders", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    const expected = 'Organization not configured for Yardi';

    // Setup requests
    const property = { code: 'test' };
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp(property))
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(403);

    const [error] = result.body.errors || [];
    const actual = error.detail || '';
    expect(actual).to.equal(expected);
  });

  it('returns an error when yardi details are not setup', async () => {
    const expected = 'Organization details not configured for Yardi';

    // Setup requests
    const property = { code: 'test' };
    sinon
      .stub(systemModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon.stub(integrationModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp(property))
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(403);

    const [error] = result.body.errors || [];
    const actual = error.detail || '';
    expect(actual).to.equal(expected);
  });

  it('returns a helpful error when Yardi request fails', done => {
    // Stup requests
    const property = { code: 'test' };
    sinon
      .stub(systemModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon
      .stub(integrationModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon
      .stub(yardi, 'getYardiPropertyWorkOrders')
      .rejects(Error('request timeout'));

    request(createApp(property))
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(500)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Unexpected error fetching work orders'
        );
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when Yardi rejected property code', done => {
    const property = { code: 'test' };
    const invalidCodeErr = Error('bad code');
    invalidCodeErr.code = 'ERR_NO_YARDI_PROPERTY';

    // Stup requests
    sinon
      .stub(systemModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon
      .stub(integrationModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon.stub(yardi, 'getYardiPropertyWorkOrders').rejects(invalidCodeErr);

    request(createApp(property))
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(404)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain('yardi code for property');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when Yardi credentials rejected', done => {
    const property = { code: 'test' };
    const invalidCodeErr = Error('bad credentials');
    invalidCodeErr.code = 'ERR_BAD_YARDI_CREDENTIALS';

    // Stup requests
    sinon
      .stub(systemModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon
      .stub(integrationModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon.stub(yardi, 'getYardiPropertyWorkOrders').rejects(invalidCodeErr);

    request(createApp(property))
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(407)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'credentials not accepted'
        );
        done();
      })
      .catch(done);
  });

  it('returns all discovered work orders as JSON/API formatted records', done => {
    const property = { code: 'test' };
    const workOrder = createWorkOrder();
    const residentJsonApi = createWorkOrderJsonApi(workOrder);
    const expected = {
      data: [residentJsonApi],
    };

    // Stup requests
    sinon
      .stub(systemModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon
      .stub(integrationModel, 'findYardi')
      .resolves(firebase.createDocSnapshot('yardi', {}));
    sinon.stub(yardi, 'getYardiPropertyWorkOrders').resolves({
      workOrders: [workOrder],
    });

    request(createApp(property))
      .get('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp(property) {
  const app = express();
  app.get(
    '/t/:propertyId',
    stubAuth,
    stubPropertyCode(property),
    yardiMiddleware({ collection: () => ({}) }),
    handler()
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function stubPropertyCode(property) {
  return (req, res, next) => {
    req.property = property;
    next();
  };
}

function createWorkOrder(config = {}) {
  return {
    id: uuid(),
    status: 'progress',
    category: 'misc',
    origin: 'OL',
    priority: 'high',
    unit: '01-123',
    resident: uuid(),
    updatedAt: 1584638500,
    createdAt: 1584638500,
    updatedBy: 'Testor',
    requestDate: '2020-01-01',
    permissionToEnter: true,
    tenantCaused: false,
    technicianNotes: 'notes',
    description: 'desc',
    problemNotes: 'notes',
    requestorName: 'Testor',
    requestorPhone: '1234567890',
    requestorEmail: 'test@email.com',
    ...config,
  };
}

function createWorkOrderJsonApi(workOrder) {
  const result = {
    id: workOrder.id,
    type: 'work-order',
    attributes: { ...workOrder },
  };
  delete result.attributes.id;
  delete result.attributes.resident;
  if (workOrder.resident) {
    result.relationships = {
      resident: {
        data: { id: workOrder.resident, type: 'resident' },
      },
    };
  }
  return result;
}
