const nock = require('nock');
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const deficiencyModel = require('../../../models/deficient-items');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const integrationsModel = require('../../../models/integrations');
const handler = require('../../../trello/api/post-deficiency-card');
const { db } = require('../../setup');

describe('Trello | API | POST Deficiency Card', () => {
  afterEach(() => {
    nock.cleanAll();
    return cleanDb(db);
  });

  it('successfully update system property trello card and deficiency with created Trello card details', async () => {
    const cardId = uuid();
    const cardUrl = 'test.com/image.png';
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const inspection = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
    });
    const item = mocking.createCompletedMainInputItem(
      'twoactions_checkmarkx',
      true
    );
    inspection.template.trackDeficientItems = true;
    inspection.template.items[itemId] = item;
    const deficiency = mocking.createDeficiency(
      {
        property: propertyId,
        inspection: inspectionId,
        item: itemId,
      },
      inspection,
      item
    );
    const property = mocking.createProperty();
    const trelloIntegration = { member: uuid(), trelloUsername: 'user' };
    const trelloPropIntegration = mocking.createPropertyTrelloIntegration();

    // Stub API
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${trelloPropIntegration.openList}&keyFromSource=all&key=key&token=token`
      )
      .reply(200, {
        id: cardId,
        shortUrl: cardUrl,
      });

    // Setup Database
    await deficiencyModel.createRecord(db, deficiencyId, deficiency);
    await propertiesModel.createRecord(db, propertyId, property);
    await inspectionsModel.createRecord(db, inspectionId, inspection);
    await integrationsModel.upsertTrello(db, trelloIntegration);
    await integrationsModel.createTrelloProperty(
      db,
      propertyId,
      trelloPropIntegration
    );

    // Execute
    const app = createApp();
    await request(app)
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    // Get Results
    const systemDoc = await systemModel.findTrelloProperty(db, propertyId);
    const deficiencyDoc = await deficiencyModel.findRecord(db, deficiencyId);

    // Assertions
    [
      {
        actual: ((systemDoc.data() || {}).cards || {})[cardId] || '',
        expected: deficiencyId,
        msg: 'added card reference to system trello properties',
      },
      {
        actual: (deficiencyDoc.data() || {}).trelloCardURL || '',
        expected: cardUrl,
        msg: 'added card reference to system trello properties',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});

function createApp() {
  const app = express();
  app.post(`/t/:deficiencyId`, stubAuth, stubTrelloReq, handler(db));
  return app;
}

function stubTrelloReq(req, res, next) {
  req.trelloCredentials = {
    authToken: 'token',
    apikey: 'key',
  };
  next();
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
