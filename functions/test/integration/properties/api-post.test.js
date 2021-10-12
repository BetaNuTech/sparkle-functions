const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const bodyParser = require('body-parser');
const sinon = require('sinon');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../properties/api/post');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Properties | API | POST', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request with invalid property payload', async () => {
    const expected = 'name';
    const res = await request(createApp())
      .post('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result
      .map(({ source }) => (source ? source.pointer : ''))
      .sort()
      .join(', ');
    expect(actual).to.equal(expected);
  });

  it('returns the property document on successful creation', done => {
    const propertyId = uuid();
    const property = mocking.createProperty({
      name: 'Not Set',
      templates: {},
    });

    const expected = {
      data: {
        id: propertyId,
        type: 'property',
        attributes: { name: 'Not Set', templates: {}, zip: '32003' },
      },
    };

    sinon.stub(propertiesModel, 'createId').returns(propertyId);
    sinon
      .stub(propertiesModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    request(createApp())
      .post(`/t`)
      .send(property)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        const actual = res.body;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('sends notification upon successful property creation', async () => {
    const expected = true;
    const propertyId = uuid();
    const property = mocking.createProperty({
      name: 'Not Set',
      templates: {},
    });

    // Stubs
    sinon
      .stub(propertiesModel, 'createId')
      .resolves(firebase.createDocSnapshot(propertyId));

    sinon
      .stub(propertiesModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    const result = sinon.stub(notificationsModel, 'addRecord').resolves();

    await request(createApp())
      .post('/t')
      .send(property)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);
    const actual = result.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const propertyId = uuid();
    const property = mocking.createProperty({
      name: 'Not Set',
      templates: {},
    });

    // Stubs
    sinon
      .stub(propertiesModel, 'createId')
      .resolves(firebase.createDocSnapshot(propertyId));

    sinon
      .stub(propertiesModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));

    const result = sinon.stub(notificationsModel, 'addRecord').resolves();

    await request(createApp())
      .post(`/t?incognitoMode=true`)
      .send(property)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = result.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/',
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
