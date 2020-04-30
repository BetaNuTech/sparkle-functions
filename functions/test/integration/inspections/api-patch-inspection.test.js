const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const patchInspProperty = require('../../../inspections/api/patch-property');

describe('Inspections | API | Patch Property Relationship', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when Yardi request fails', done => {
    const expected = 'body missing property';

    request(createApp())
      .patch('/t/123')
      .send()
      .expect('Content-Type', /json/)
      .expect(400)
      .then(res => {
        const actual = res.body.message;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('rejects request to reassign non-existent property', done => {
    const expected = 'body contains bad property';

    // Stub Requests
    sinon.stub(propertiesModel, 'findRecord').rejects(Error('ignore'));

    request(createApp())
      .patch('/t/123')
      .send({ property: '-invalid' })
      .expect('Content-Type', /json/)
      .expect(400)
      .then(res => {
        const actual = res.body.message;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('rejects request to reassign non-existent inspection', async () => {
    const propertySnap = createSnap({ name: 'test' });

    // Stub Requests
    sinon.stub(propertiesModel, 'findRecord').resolves(propertySnap);
    sinon.stub(inspectionsModel, 'findRecord').rejects(Error('not found'));

    // Execute & Get Result
    const app = createApp();
    const result = await request(app)
      .patch('/t/-invalid')
      .send({ property: '-123' })
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal('requested inspection not found');
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:inspectionId',
    bodyParser.json(),
    stubAuth,
    patchInspProperty({}, {})
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function createSnap(data) {
  return {
    exists: true,
    val: () => data,
  };
}
