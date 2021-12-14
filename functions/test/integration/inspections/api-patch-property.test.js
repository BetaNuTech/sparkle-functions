const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const firebase = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const notificationsModel = require('../../../models/notifications');

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
    const propertyId = uuid();
    const property = mocking.createProperty();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(inspectionsModel, 'findRecord').rejects(Error('not found'));

    // Execute & Get Result
    const result = await request(createApp())
      .patch('/t/-invalid')
      .send({ property: '-123' })
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    const actual = result.body.message;
    expect(actual).to.equal('requested inspection not found');
  });

  it('sends notification upon successful inspection completion', async () => {
    const expected = true;
    const propertyId = uuid();
    const inspectionId = uuid();
    const property = mocking.createProperty();
    const inspection = mocking.createInspection({ property: propertyId });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon.stub(inspectionsModel, 'reassignProperty').resolves();
    sinon.stub(propertiesModel, 'updateMetaData').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send({ property: '-123' })
      .expect('Content-Type', /json/)
      .expect(201);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const propertyId = uuid();
    const inspectionId = uuid();
    const property = mocking.createProperty();
    const inspection = mocking.createInspection({ property: propertyId });

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon.stub(inspectionsModel, 'reassignProperty').resolves();
    sinon.stub(propertiesModel, 'updateMetaData').resolves();
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}?incognitoMode=true`)
      .send({ property: '-123' })
      .expect('Content-Type', /json/)
      .expect(201);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:inspectionId',
    bodyParser.json(),
    stubAuth,
    patchInspProperty({
      collection: () => {},
      batch: () => ({
        commit: () => Promise.resolve(),
      }),
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
