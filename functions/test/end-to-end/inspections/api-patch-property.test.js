const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const handler = require('../../../inspections/api/patch-property');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../setup');
const mocking = require('../../../test-helpers/mocking');

const PROPERTY_ID = uuid();
const INSPECTION_ID = uuid();
const PROPERTY_PATH = `/properties/${PROPERTY_ID}`;
const INSPECTION_PATH = `/inspections/${INSPECTION_ID}`;
const PROPERTY_DATA = {
  inspections: { [INSPECTION_ID]: true },
};
const INSPECTION_DATA = mocking.createInspection({ property: PROPERTY_ID });

describe('Inspections | API | Patch Property', () => {
  afterEach(() => cleanDb(db));

  it('rejects request missing a payload', async () => {
    // setup database
    await db.ref(PROPERTY_PATH).set(PROPERTY_DATA);
    await db.ref(INSPECTION_PATH).set(INSPECTION_DATA);

    // Execute & Get Result
    const app = createApp();
    const result = await request(app)
      .patch(`/t/${INSPECTION_ID}`)
      .send()
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(400);

    // Assertions
    expect(result.body.message).to.equal('body missing property');
  });
});

function createApp() {
  const app = express();
  app.patch('/t/:inspectionId', bodyParser.json(), handler(db));
  return app;
}
