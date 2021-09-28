const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../properties/api/put');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

const propertyId = uuid();

describe('Properties | API | PUT', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request on missing update payload', async () => {
    const expected = 'Bad Request: property update body required';

    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update property with invalid update payload', async () => {
    const expected = 'id';
    const invalidUpdate = { id: 1 };

    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send(invalidUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const { source = {} } = error;
    const actual = source.pointer || '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update property with non-existent property', async () => {
    const expected = 'Property not found';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send({ name: 'test' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.title : '';
    expect(actual).to.equal(expected);
  });

  it('returns the property JSON API document on successful creation', async () => {
    const property = mocking.createProperty();
    const update = { name: 'test' };

    const expected = {
      data: {
        id: propertyId,
        type: 'property',
        attributes: { ...property, ...update },
      },
    };

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon.stub(propertiesModel, 'firestoreUpdateRecord').resolves();

    const res = await request(createApp())
      .put(`/t/${propertyId}`)
      .send(update)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = res.body;
    expect(actual).to.deep.equal(expected);
  });

  it('sends notification upon successful property update', async () => {
    const expected = true;
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon
      .stub(propertiesModel, 'firestoreUpdateRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    const result = sinon
      .stub(notificationsModel, 'firestoreAddRecord')
      .resolves();

    await request(createApp())
      .put(`/t/${propertyId}`)
      .send({ name: 'test' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);
    const actual = result.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    sinon
      .stub(propertiesModel, 'firestoreUpdateRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    const result = sinon
      .stub(notificationsModel, 'firestoreAddRecord')
      .resolves();

    await request(createApp())
      .put(`/t/${propertyId}?incognitoMode=true`)
      .send(property)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = result.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.put(
    '/t/:propertyId',
    bodyParser.json(),
    stubAuth,
    handler({ collection: () => {} })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
