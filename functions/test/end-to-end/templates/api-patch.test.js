const { expect } = require('chai');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const templatesModel = require('../../../models/templates');
const handler = require('../../../templates/api/patch');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db } = require('../../setup');

describe('Templates | API | PATCH', () => {
  afterEach(() => cleanDb(db));

  it("should remove a templates section and all it's items", async () => {
    const templateId = uuid();
    const sectionId = uuid();
    const itemOneId = uuid();
    const itemTwoId = uuid();
    const template = mocking.createTemplate({
      completedAt: 1,
      sections: {
        keep: mocking.createSection({ index: 0 }),
        [sectionId]: mocking.createSection({ index: 1 }),
      },
      items: {
        keepItem: mocking.completedTextInputItem({
          sectionId: 'keep',
          index: 0,
        }),
        [itemOneId]: mocking.completedTextInputItem({ sectionId, index: 0 }),
        [itemTwoId]: mocking.completedTextInputItem({ sectionId, index: 1 }),
      },
    });

    // Setup database
    await templatesModel.createRecord(db, templateId, template);

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${templateId}?incognitoMode=true`)
      .send({ sections: { [sectionId]: null } })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const snapshot = await templatesModel.findRecord(db, templateId);
    const result = snapshot.data() || {};

    // Assertions
    const tests = [
      {
        expected: undefined,
        actual: (result.sections || {})[sectionId],
        message: 'removed deleted section',
      },
      {
        expected: undefined,
        actual: (result.items || {})[itemOneId],
        message: 'removed deleted section 1st item',
      },
      {
        expected: undefined,
        actual: (result.items || {})[itemTwoId],
        message: 'removed deleted section 2nd item',
      },
      {
        expected: true,
        actual: Boolean((result.sections || {}).keep),
        message: 'keep section unrelated to deleted section',
      },
      {
        expected: true,
        actual: Boolean((result.items || {}).keepItem),
        message: 'keep item unrelated to section delete',
      },
    ];

    for (let i = 0; i < tests.length; i++) {
      const { expected, actual, message } = tests[i];
      expect(actual).to.equal(expected, message);
    }
  });

  it('should complete a template eligible to become complete', async () => {
    const expected = true;
    const templateId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const template = mocking.createTemplate({
      sections: {
        [sectionId]: mocking.createSection({ index: 1 }),
      },
    });

    // Setup database
    await templatesModel.createRecord(db, templateId, template);

    // Execute
    const app = createApp();
    await request(app)
      .patch(`/t/${templateId}?incognitoMode=true`)
      .send({
        items: {
          [itemId]: {
            index: 0,
            sectionId,
            itemType: 'signature',
            mainInputZeroValue: 3,
            mainInputOneValue: 0,
            mainInputTwoValue: 0,
            mainInputThreeValue: 0,
            mainInputFourValue: 0,
          },
        },
      })
      .expect('Content-Type', /json/)
      .expect(201);

    // Get Results
    const snapshot = await templatesModel.findRecord(db, templateId);
    const result = snapshot.data() || {};

    // Assertions
    const actual = Boolean(result.completedAt);
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch('/t/:templateId', bodyParser.json(), handler(db));
  return app;
}
