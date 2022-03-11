const request = require('supertest');
const { expect } = require('chai');
const express = require('express');
const sinon = require('sinon');
const templatesModel = require('../../../models/templates');
const handler = require('../../../templates/api/post');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Templates | API | POST', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to clone a non-existent template', async () => {
    const expected = 'Template clone target not found';

    // Stub Requests
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    const res = await request(createApp())
      .post('/t?clone=fake')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const result = (res.body.errors || [])[0] || {};
    const actual = result.title || '';
    expect(actual).to.equal(expected);
  });

  it('creates a new template record', async () => {
    const expected = 'New Template -';
    const templateId = uuid();

    // Stub Requests
    sinon.stub(templatesModel, 'createId').returns(templateId);
    sinon
      .stub(templatesModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(templateId, { name: 'created' }));

    const res = await request(createApp())
      .post('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = (res.body || {}).data || {};
    const actual = (result.attributes || {}).name || '';
    expect(actual).to.contain(expected);
  });

  it('clones an existing template record', async () => {
    const templateId = uuid();
    const clonedTemplateId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const clonedItem = mocking.createItem({ sectionId, version: 0 });
    const clonedSection = mocking.createSection();
    const expectedName = 'Copy: Cloned Template';
    const expected = mocking.createTemplate({
      name: 'Cloned Template',
      sections: { [sectionId]: clonedSection },
      items: { [itemId]: clonedItem },
    });

    // Stub Requests
    sinon.stub(templatesModel, 'createId').returns(templateId);
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(clonedTemplateId, expected));
    sinon
      .stub(templatesModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(templateId, { name: 'created' }));

    const res = await request(createApp())
      .post(`/t?clone=${clonedTemplateId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Test results
    const result = (res.body || {}).data || {};
    const actual = result.attributes || {};
    const resultItemId = Object.keys(actual.items || {})[0] || '';
    const resultSectionId = Object.keys(actual.sections || {})[0] || '';

    // Update dynamic attributes
    expected.sections[resultSectionId] = expected.sections[sectionId];
    delete expected.sections[sectionId];
    expected.items[resultItemId] = expected.items[itemId];
    delete expected.items[itemId];
    expected.name = actual.name;
    expected.createdAt = actual.createdAt;
    expected.updatedAt = actual.updatedAt;

    // Assertions
    expect(actual.name).to.contain(expectedName);
    expect(actual).to.deep.equal(expected);
  });

  it('creates a template with creation date that matches the updated date', async () => {
    const templateId = uuid();

    // Stub Requests
    sinon.stub(templatesModel, 'createId').returns(templateId);
    sinon
      .stub(templatesModel, 'createRecord')
      .resolves(firebase.createDocSnapshot(templateId, { name: 'created' }));

    const res = await request(createApp())
      .post('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const result = (res.body || {}).data || {};
    const attributes = result.attributes || {};
    const actual = attributes.createdAt || NaN;
    const expected = attributes.updatedAt || NaN;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.post('/t', stubAuth, handler({ collection: () => {} }));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
