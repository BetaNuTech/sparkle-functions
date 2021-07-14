const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const log = require('../../../utils/logger');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const propertiesModel = require('../../../models/properties');
const templatesModel = require('../../../models/templates');
const postInspection = require('../../../inspections/api/post');
const firebase = require('../../../test-helpers/firebase');

const USER_ID = '123';

describe('Inspections | API | POST', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to create inspection without required request values', async () => {
    const expected = 'property,template';

    const res = await request(createApp())
      .post('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result.map(err => err.source.pointer).join(',');
    expect(actual).to.equal(expected);
  });

  it('rejects request to create inspection with non-existent property', async () => {
    const expected = 'Property not found';

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post('/t')
      .send({ property: '-invalid', template: '1' })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to create inspection with non-existent template', async () => {
    const expected = 'Template not found';
    const propertyId = uuid();
    const property = mocking.createProperty();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(templatesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    // Execute & Get Result
    const app = createApp();
    const res = await request(app)
      .post('/t')
      .send({ property: propertyId, template: '-invalid' })
      .expect('Content-Type', /json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('returns new inspection document on successfull creation', async () => {
    const propertyId = uuid();
    const templateId = uuid();
    const template = {
      trackDeficientItems: false,
      name: 'Test template',
      sections: {},
      items: {},
    };
    const property = mocking.createProperty();
    const expected = {
      data: {
        inspection: {
          template: { ...template },
          inspectorName: '',
          inspector: USER_ID,
        },
      },
    };

    // Stub Requests
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(templatesModel, 'firestoreFindRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));

    const res = await request(createApp())
      .post(`/t`)
      .send({ property: propertyId, template: templateId })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body;
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/',
    bodyParser.json(),
    stubAuth,
    postInspection({ collection: () => {} })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: USER_ID };
  next();
}
