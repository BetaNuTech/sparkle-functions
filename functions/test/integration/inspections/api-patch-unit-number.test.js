const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const firebase = require('../../../test-helpers/firebase');
const inspectionsModel = require('../../../models/inspections');

const patchUnitNumber = require('../../../inspections/api/patch-unit-number');

describe('Inspections | API | Patch Unit Number', () => {
  afterEach(() => sinon.restore());

  it('rejects request missing a unit number', async () => {
    const expected = 'body missing unit number';

    // Execute & Get Result
    const res = await request(createApp())
      .patch('/t/123')
      .send({})
      .expect('Content-Type', /vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    expect(error.title).to.equal(expected);
  });

  it('rejects request containing a non-string unit number', async () => {
    const expected = 'body contains bad unit number';

    // Execute & Get Result
    const res = await request(createApp())
      .patch('/t/123')
      .send({ unitNumber: 123 })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    expect(error.title).to.equal(expected);
  });

  it('rejects request containing an overly long unit number', async () => {
    const expected = 'body contains bad unit number';

    // Execute & Get Result
    const res = await request(createApp())
      .patch('/t/123')
      .send({ unitNumber: 'a'.repeat(25) })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    expect(error.title).to.equal(expected);
  });

  it('rejects request to update a non-existent inspection', async () => {
    const expected = 'Inspection not found';
    const inspectionId = uuid();

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, undefined));

    // Execute & Get Result
    const res = await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send({ unitNumber: 'A12' })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    expect(error.title).to.equal(expected);
  });

  it('updates only the unit number of a completed inspection', async () => {
    const expected = ['unitNumber'];
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: uuid(),
      inspectionCompleted: true,
      completionDate: 1601494027,
    });

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    const update = sinon.stub(inspectionsModel, 'updateRecord').resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send({ unitNumber: 'A12' })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = Object.keys(update.firstCall.args[2] || {});
    expect(actual).to.deep.equal(expected);
  });

  it('trims the provided unit number before persisting it', async () => {
    const expected = 'A12';
    const inspectionId = uuid();
    const inspection = mocking.createInspection({ property: uuid() });

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    const update = sinon.stub(inspectionsModel, 'updateRecord').resolves();

    // Execute
    const res = await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send({ unitNumber: '  A12  ' })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = (update.firstCall.args[2] || {}).unitNumber;
    expect(actual).to.equal(expected);
    expect(res.body.data.attributes.unitNumber).to.equal(expected);
  });

  it('accepts an empty unit number to remove it', async () => {
    const expected = '';
    const inspectionId = uuid();
    const inspection = mocking.createInspection({
      property: uuid(),
      unitNumber: 'A12',
    });

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    const update = sinon.stub(inspectionsModel, 'updateRecord').resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send({ unitNumber: '' })
      .expect('Content-Type', /vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = (update.firstCall.args[2] || {}).unitNumber;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:inspectionId',
    bodyParser.json(),
    stubAuth,
    patchUnitNumber({
      collection: () => {},
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
