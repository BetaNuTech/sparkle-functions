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
const inspectionsModel = require('../../../models/inspections');
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
    const expected = 'template';
    const propertyId = uuid();

    const res = await request(createApp())
      .post(`/t/${propertyId}`)
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
    const propertyId = uuid();

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post(`/t/${propertyId}`)
      .send({ template: '1' })
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
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    // Execute & Get Result
    const app = createApp();
    const res = await request(app)
      .post(`/t/${propertyId}`)
      .send({ template: '-invalid' })
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
    const inspectionId = uuid();
    const template = {
      trackDeficientItems: false,
      name: 'Test template',
      sections: {},
      items: {},
    };
    const inspection = {
      templateId,
      property: propertyId,
      template: { ...template },
      inspectorName: '',
      inspector: USER_ID,
      totalItems: 1,
      templateName: template.name,
      itemsCompleted: 0,
      inspectionCompleted: false,
      deficienciesExist: false,
      score: 0,
      createdAt: Math.floor(Date.now() / 1000),
      creationDate: Math.floor(Date.now() / 1000),
      updatedLastDate: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      templateCategory: '',
    };
    const property = mocking.createProperty();
    const expected = {
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: inspection,
      },
    };

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon.stub(inspectionsModel, 'createId').returns(inspectionId);
    sinon.stub(inspectionsModel, 'createRecord').resolves();

    const res = await request(createApp())
      .post(`/t/${propertyId}`)
      .send({ template: templateId })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = res.body;
    expect(actual).to.deep.equal(expected);
  });

  it('adds item defaults to embedded template', async () => {
    const propertyId = uuid();
    const templateId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const template = {
      trackDeficientItems: false,
      name: 'Test template',
      sections: {},
      items: {
        [itemId]: {
          ...mocking.createIncompleteMainInputItem('twoactions_checkmarkx', {
            sectionId: uuid(),
          }),
          mainInputSelection: undefined,
        },
      },
    };
    const property = mocking.createProperty();
    const expected = -1;

    // Stub Requests
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon.stub(inspectionsModel, 'createId').returns(inspectionId);
    sinon.stub(inspectionsModel, 'createRecord').resolves();

    const res = await request(createApp())
      .post(`/t/${propertyId}`)
      .send({ template: templateId })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual =
      res.body.data.attributes.template.items[itemId].mainInputSelection;
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId',
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
