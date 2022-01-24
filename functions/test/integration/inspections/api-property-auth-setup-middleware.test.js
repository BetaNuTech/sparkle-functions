const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const log = require('../../../utils/logger');
const uuid = require('../../../test-helpers/uuid');
const stubs = require('../../../test-helpers/stubs');
const mocking = require('../../../test-helpers/mocking');
const inspectionsModel = require('../../../models/inspections');
const middleware = require('../../../inspections/api/property-auth-setup-middleware');

describe('Inspections | API | Property Auth Setup Middlware', () => {
  afterEach(() => sinon.restore());

  it('rejects when inspection lookup fails', done => {
    sinon.stub(log, 'error').callsFake(() => true);
    sinon.stub(inspectionsModel, 'findRecord').rejects(Error('dang'));

    request(createApp())
      .put(`/t/${uuid()}`)
      .send({ update: true })
      .expect(500)
      .then(() => done())
      .catch(done);
  });

  it('updates the request params with the property identifier from the inspection', async () => {
    const expected = uuid();
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: expected,
    });
    inspection.id = inspectionId;
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(stubs.wrapSnapshot(inspection));

    const res = await request(createApp())
      .put(`/t/${inspectionId}`)
      .send({ score: 1 })
      .expect(200);

    const { propertyId: actual } = res.body;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.put(
    '/t/:inspectionId',
    bodyParser.json(),
    middleware({
      collection: () => {},
    }),
    // Send the "propertyId" request param as success payload
    (req, res) => res.status(200).send({ propertyId: req.propertyId })
  );
  return app;
}
