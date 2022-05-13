const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const deficiencyModel = require('../../../models/deficient-items');
const handler = require('../../../deficient-items/api/put-batch');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

describe('Deficient Items | API | PUT Batch', () => {
  afterEach(() => cleanDb(db));

  it('transitions a group of deficient items to new state', async () => {
    const expected = ['closed', 'closed'];
    const deficiencyOneId = uuid();
    const deficiencyTwoId = uuid();
    const changes = { state: 'closed' }; // valid request
    const propertyId = uuid();
    const inspectionId = uuid();
    const deficiencyOne = mocking.createDeficiency({
      state: 'requires-action',
      inspection: inspectionId,
      property: propertyId,
      item: uuid(),
    });
    const deficiencyTwo = mocking.createDeficiency({
      state: 'requires-action',
      inspection: inspectionId,
      property: propertyId,
      item: uuid(),
    });

    // Setup
    await deficiencyModel.createRecord(db, deficiencyOneId, deficiencyOne);
    await deficiencyModel.createRecord(db, deficiencyTwoId, deficiencyTwo);

    // Execute
    await request(createApp())
      .put(`/t?id=${deficiencyOneId}&id=${deficiencyTwoId}`)
      .send(changes)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    // Test results
    const deficienciesSnap = await deficiencyModel.findMany(
      db,
      deficiencyOneId,
      deficiencyTwoId
    );

    // Assertions
    const actual = [];
    deficienciesSnap.docs.forEach(doc => {
      actual.push((doc.data() || {}).state || '');
    });

    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.put(
    '/t',
    bodyParser.json(),
    stubAuth,
    handler(
      db,
      false // disable progress note notifications
    )
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
