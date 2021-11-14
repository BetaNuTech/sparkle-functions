const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const log = require('../../../utils/logger');
const mocking = require('../../../test-helpers/mocking');
const uuid = require('../../../test-helpers/uuid');
const inspectionsModel = require('../../../models/inspections');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const patchInspection = require('../../../inspections/api/patch-template');
const firebase = require('../../../test-helpers/firebase');
const { storage } = require('../../setup');

const USER_ID = '123';

describe('Inspections PATCH TEMPLATE | API | PATCH Template', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request to update inspection without providing update', async () => {
    const expected = 'body';
    const propertyId = uuid();

    // Execute
    const res = await request(createApp())
      .patch(`/t/${propertyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400);

    // Assertions
    const result = res.body.errors || [];
    const actual = result.map(err => err.source.pointer).join(',');
    expect(actual).to.equal(expected);
  });

  it('rejects request to update inspection with non-existent inspection', async () => {
    const expected = 'Inspection not found';
    const inspectionId = uuid();

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot()); // empty

    // Execute
    const res = await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send({ items: {} })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404);

    // Assertions
    const [result] = res.body.errors || [];
    const actual = result ? result.title : '';
    expect(actual).to.equal(expected);
  });

  it('returns an empty success response when user updates would have no impact', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const item = mocking.createCompletedMainInputItem(
      'twoactions_checkmarkx',
      false,
      { sectionId }
    );
    const template = mocking.createTemplate({
      name: 'test',
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        [itemId]: item,
      },
    });
    const inspection = mocking.createInspection({
      template,
      totalItems: 1,
      itemsCompleted: 1,
      deficienciesExist: false,
      inspectionCompleted: true,
      completionDate: 1633313693,
      score: 100,
      updatedLastDate: 1633313693,
      updatedAt: 1633313693,
      property: propertyId,
    });
    const userUpdate = {
      items: {
        [itemId]: { mainInputSelection: item.mainInputSelection }, // no change
      },
    };

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send(userUpdate)
      .expect(204);
  });

  it('returns updated portion of inspection as JSON-API document on successful update', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const currentItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId }
    );
    const secondItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId }
    );
    const updates = {
      items: {
        [itemId]: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
      },
    };
    const template = mocking.createTemplate({
      name: 'test',
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        [itemId]: currentItem,
        [uuid()]: secondItem, // stays incomplete
      },
    });
    const inspection = mocking.createInspection({
      template,
      inspectionCompleted: false,
      totalItems: 2,
      property: propertyId,
    });
    const updatedInspection = JSON.parse(JSON.stringify(inspection)); // clone
    Object.assign(
      updatedInspection.template.items[itemId],
      updates.items[itemId] // Merge in user updates
    );

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    const inspectionUpdate = sinon
      .stub(inspectionsModel, 'setRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, updatedInspection));

    // Execute
    const res = await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send(updates)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Lookup update written to database
    const firstCallArgs = inspectionUpdate.firstCall || { args: [] };
    const writeResults = firstCallArgs.args[2] || {};
    const expected = {
      id: inspectionId,
      type: 'inspection',
      attributes: writeResults,
    };

    // Assertions
    const actual = res.body.data;
    expect(actual).to.deep.equal(expected);
  });

  it('adds item defaults to a successful updated', async () => {
    const expected = -1;
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const itemTwoId = uuid();
    const currentItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId }
    );
    const secondItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId }
    );
    delete secondItem.mainInputSelection; // Remove default attribute
    const updates = {
      items: {
        [itemId]: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
      },
    };
    const template = mocking.createTemplate({
      name: 'test',
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        [itemId]: currentItem,
        [itemTwoId]: secondItem,
      },
    });
    const inspection = mocking.createInspection({
      template,
      inspectionCompleted: false,
      totalItems: 2,
      property: propertyId,
    });

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon.stub(inspectionsModel, 'setRecord').resolves();

    // Execute
    const res = await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send(updates)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual =
      res.body.data.attributes.template.items[itemTwoId].mainInputSelection;
    expect(actual).to.equal(expected);
  });

  it('sends notification upon successful inspection completion', async () => {
    const expected = true;
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const property = mocking.createProperty();
    const currentItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId }
    );
    const completeInspUpdate = {
      items: {
        [itemId]: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
      },
    };
    const template = mocking.createTemplate({
      name: 'test',
      requireDeficientItemNoteAndPhoto: false,
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        [itemId]: currentItem,
      },
    });
    const inspection = mocking.createInspection({
      template,
      inspectionCompleted: false,
      totalItems: 1,
      itemsCompleted: 0,
      property: propertyId,
    });
    const updatedInspection = JSON.parse(JSON.stringify(inspection)); // clone
    Object.assign(
      updatedInspection.template.items[itemId],
      completeInspUpdate.items[itemId] // Merge in user updates
    );

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(inspectionsModel, 'setRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, updatedInspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(
        firebase.createDocSnapshot(
          propertyId,
          firebase.createDocSnapshot(property)
        )
      );
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}`)
      .send(completeInspUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Assertions
    const actual = sendNotification.called;
    expect(actual).to.equal(expected);
  });

  it('does not send notification in incognito mode', async () => {
    const expected = false;
    const propertyId = uuid();
    const inspectionId = uuid();
    const sectionId = uuid();
    const itemId = uuid();
    const property = mocking.createProperty();
    const currentItem = mocking.createIncompleteMainInputItem(
      'twoactions_checkmarkx',
      { sectionId }
    );
    const completeInspUpdate = {
      items: {
        [itemId]: {
          mainInputSelected: true,
          mainInputSelection: 0,
        },
      },
    };
    const template = mocking.createTemplate({
      name: 'test',
      requireDeficientItemNoteAndPhoto: false,
      sections: {
        [sectionId]: mocking.createSection(),
      },
      items: {
        [itemId]: currentItem,
      },
    });
    const inspection = mocking.createInspection({
      template,
      inspectionCompleted: false,
      totalItems: 1,
      itemsCompleted: 0,
      property: propertyId,
    });
    const updatedInspection = JSON.parse(JSON.stringify(inspection)); // clone
    Object.assign(
      updatedInspection.template.items[itemId],
      completeInspUpdate.items[itemId] // Merge in user updates
    );

    // Stub Requests
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(inspectionsModel, 'setRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, updatedInspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(
        firebase.createDocSnapshot(
          propertyId,
          firebase.createDocSnapshot(property)
        )
      );
    const sendNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    // Execute
    await request(createApp())
      .patch(`/t/${inspectionId}?incognitoMode=true`)
      .send(completeInspUpdate)
      .expect('Content-Type', /application\/vnd.api\+json/)
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
    patchInspection(
      {
        collection: () => {},
        batch: () => ({ commit: () => Promise.resolve() }),
      },
      storage
    )
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: USER_ID };
  next();
}
