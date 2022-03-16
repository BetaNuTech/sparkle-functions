const request = require('supertest');
const { expect } = require('chai');
const bodyParser = require('body-parser');
const express = require('express');
const sinon = require('sinon');
const templatesModel = require('../../../models/templates');
const templateCategoriesModel = require('../../../models/template-categories');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../templates/api/patch');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const firebase = require('../../../test-helpers/firebase');
const log = require('../../../utils/logger');

describe('Templates | API | PATCH', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request for missing update payload', async () => {
    const templateId = uuid();
    const expected = 'Bad Request: template update body required';

    // Execute
    const res = await request(createApp())
      .patch(`/t/${templateId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const actual = error ? error.detail : '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update template with invalid update payload', async () => {
    const expected = 'name';
    const templateId = uuid();
    const invalidUpdate = { name: 1 };

    // Execute
    const res = await request(createApp())
      .patch(`/t/${templateId}`)
      .send(invalidUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const [error] = res.body.errors || [];
    const { source = {} } = error;
    const actual = source.pointer || '';
    expect(actual).to.equal(expected);
  });

  it('rejects request to update template that cannot be found', () => {
    const templateId = uuid();

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .patch(`/t/${templateId}`)
      .send({ name: 'New Name' })
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect(404); // Assertion
  });

  it('rejects request to update template with a category that cannot be found', () => {
    const templateId = uuid();
    const template = mocking.createTemplate();

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .patch(`/t/${templateId}`)
      .send({ category: 'fake' })
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect(400); // Assertion
  });

  it('rejects request to update template with incomplete new item', () => {
    const templateId = uuid();
    const template = mocking.createTemplate();

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));

    return request(createApp())
      .patch(`/t/${templateId}`)
      .send({
        items: { new: { title: 'invalid', itemType: 'main' } },
      })
      .expect('Content-Type', /application\/vnd\.api\+json/)
      .expect(400); // Assertion
  });

  it('sends a successfully empty response when update had no effect', () => {
    const templateId = uuid();
    const template = mocking.createTemplate({});

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    return request(createApp())
      .patch(`/t/${templateId}`)
      .send({ sections: { fake: null } }) // delete non-existent section
      .expect(204); // Assertion
  });

  it('sends a successfully response when update was successful', () => {
    const templateId = uuid();
    const template = mocking.createTemplate({});

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty
    sinon.stub(templatesModel, 'setRecord').resolves();

    return request(createApp())
      .patch(`/t/${templateId}?incognitoMode=true`)
      .send({ name: 'updated' }) // delete non-existent section
      .expect(201); // Assertion
  });

  it('sends creation notification upon successful 1st template update', async () => {
    const templateId = uuid();
    const template = mocking.createTemplate({});
    const expected = 'Template Creation';

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty
    sinon.stub(templatesModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch(`/t/${templateId}`)
      .send({
        name: 'completed template',
        sections: { one: removeUneditable(mocking.createSection()) },
        items: {
          two: removeUneditable(
            mocking.incompletedSignatureInputItem({
              title: 't',
              sectionId: 'one',
            })
          ),
        },
      })
      .expect(201); // Assertion

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { title: '' }).title;
    expect(actual).to.equal(expected);
  });

  it('sends update notification upon successful template update', async () => {
    const templateId = uuid();
    const template = mocking.createTemplate({
      completedAt: 1,
      sections: {
        one: mocking.createSection(),
      },
      items: {
        two: mocking.incompletedSignatureInputItem({ sectionId: 'one' }),
      },
    });
    const expected = 'Template Update';

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty
    sinon.stub(templatesModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch(`/t/${templateId}`)
      .send({ name: 'updated template' })
      .expect(201); // Assertion

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { title: '' }).title;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const templateId = uuid();
    const template = mocking.createTemplate({
      completedAt: 1,
      sections: {
        one: mocking.createSection(),
      },
      items: {
        two: mocking.incompletedSignatureInputItem({ sectionId: 'one' }),
      },
    });
    const expected = false;

    // Stubs
    sinon
      .stub(templatesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(templateId, template));
    sinon
      .stub(templateCategoriesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty
    sinon.stub(templatesModel, 'setRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .patch(`/t/${templateId}?incognitoMode=true`)
      .send({ name: 'updated template' })
      .expect(201); // Assertion

    const actual = addNotification.called;
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch(
    '/t/:templateId',
    bodyParser.json(),
    stubAuth,
    handler({
      collection: () => {},
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { admin: true, id: '123' };
  next();
}

/**
 * Remove all attributes of sections
 * and items that users of the PATCH
 * template endpoint are not allowed
 * to provide and should not be set
 * @param  {Object} src - section or item
 * @return {Object}
 */
function removeUneditable(src) {
  const result = JSON.parse(JSON.stringify(src || {}));
  delete result.added_multi_section;
  delete result.deficient;
  delete result.isItemNA;
  delete result.isTextInputItem;
  delete result.textInputValue;
  delete result.mainInputNotes;
  delete result.inspectorNotes;
  delete result.signatureDownloadURL;
  delete result.signatureTimestampKey;
  delete result.mainInputSelected;
  delete result.mainInputSelection;
  delete result.adminEdits;
  delete result.photosData;
  return result;
}
