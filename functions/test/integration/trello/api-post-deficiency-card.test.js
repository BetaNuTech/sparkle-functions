const request = require('supertest');
const moment = require('moment-timezone');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const trelloService = require('../../../services/trello');
const systemModel = require('../../../models/system');
const deficiencyModel = require('../../../models/deficient-items');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const handler = require('../../../trello/api/post-deficiency-card');

const CLIENT_API_DOMAIN =
  'test-app.com/properties/{{propertyId}}/deficient-items/{{deficientItemId}}';

describe('Trello | API | POST Deficiency Card', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when deficiency cannot be found', done => {
    const expected = 'deficiency could not be found';
    const deficiencyId = uuid();

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId));

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when deficiency property cannot be found', done => {
    const expected = 'property could not be found';
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiency = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    });

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId));

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('rejects request to create a 2nd Trello card for deficiency', done => {
    const expected = 'already has published Trello Card';
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiency = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    });
    const property = mocking.createProperty();

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves(uuid());

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when Trello integration details are not set', done => {
    const expected = 'integration details for property not found';
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const integrationId = `trello-${propertyId}`;
    const deficiency = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    });
    const property = mocking.createProperty();

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId));

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it("returns a helpful error when deficiency's inspection cannot be found", done => {
    const expected = 'Inspection of Deficiency does not exist';
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const integrationId = `trello-${propertyId}`;
    const deficiency = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
    });
    const property = mocking.createProperty();
    const trelloIntegration = mocking.createPropertyTrelloIntegration();

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId));

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('publishes Trello card using system credentials and deficiency state', done => {
    const expected = {
      openList: uuid(),
      apikey: 'key',
      authToken: 'token',
      name: 'test-title',
    };
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const integrationId = `trello-${propertyId}`;
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
        itemTitle: expected.name,
      },
      inspection,
      item
    );
    const property = mocking.createProperty();
    const trelloIntegration = mocking.createPropertyTrelloIntegration({
      openList: expected.openList,
    });

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon.stub(trelloService, 'publishAllCardAttachments').resolves([]);

    const actual = {};
    sinon
      .stub(trelloService, 'publishListCard')
      .callsFake((openList, authToken, apikey, payload) => {
        actual.openList = openList;
        actual.apikey = apikey;
        actual.authToken = authToken;
        actual.name = payload.name;
        return Promise.reject(Error('fail'));
      });

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('publishes any inspection item photos to new Trello card as attachments', async () => {
    const expected = ['google.com/ok.jpg', 'google.com/okb.jpg'];
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const integrationId = `trello-${propertyId}`;
    const inspection = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
    });
    const photoDataOneId = `${Math.round(Date.now() / 1000)}`;
    const photoDataTwoId = `${Math.round((Date.now() - 1000) / 1000)}`;
    const item = mocking.createCompletedMainInputItem(
      'twoactions_checkmarkx',
      true,
      {
        photosData: {
          [photoDataOneId]: mocking.createInspectionItemPhotoData({
            downloadURL: expected[0],
          }),
          [photoDataTwoId]: mocking.createInspectionItemPhotoData({
            downloadURL: expected[1],
          }),
        },
      }
    );
    inspection.template.trackDeficientItems = true;
    inspection.template.items[itemId] = item;
    const deficiency = mocking.createDeficiency(
      {
        property: propertyId,
        inspection: inspectionId,
        item: itemId,
        itemTitle: expected.name,
      },
      inspection,
      item
    );
    const property = mocking.createProperty();
    const trelloIntegration = mocking.createPropertyTrelloIntegration();

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon
      .stub(trelloService, 'publishListCard')
      .resolves({ id: uuid(), shortUrl: 'trello.com/short' });
    sinon.stub(systemModel, 'upsertPropertyTrello').rejects(Error('stop here'));

    let actual = [];
    sinon
      .stub(trelloService, 'publishAllCardAttachments')
      .callsFake((openList, authToken, apikey, urls) => {
        actual = urls.sort();
        return Promise.resolve(urls.map(() => uuid()));
      });

    await request(createApp())
      .post(`/t/${deficiencyId}`)
      .send();

    expect(actual).to.deep.equal(expected);
  });

  it('returns JSON-API formatted trello card record to a successful request', done => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const cardId = uuid();
    const cardUrl = 'test.com/image.png';
    const integrationId = `trello-${propertyId}`;
    const expected = {
      data: {
        id: cardId,
        type: 'trello-card',
        data: { shortUrl: cardUrl },
      },
      relationships: {
        deficiency: {
          id: deficiencyId,
          type: 'deficiency',
        },
      },
    };
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
    const trelloIntegration = mocking.createPropertyTrelloIntegration();
    const trelloResponse = {
      id: cardId,
      shortUrl: cardUrl,
    };

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon.stub(trelloService, 'publishListCard').resolves(trelloResponse);
    sinon.stub(trelloService, 'publishAllCardAttachments').resolves([]);
    sinon.stub(systemModel, 'upsertPropertyTrello').resolves();
    sinon.stub(deficiencyModel, 'updateRecord').resolves();

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        const actual = res.body;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it("should apply deficiency's due date to the Trello card using the property's zip as a UTC offest", done => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const integrationId = `trello-${propertyId}`;
    const now = Math.round(Date.now() / 1000);
    const expected = moment(now * 1000)
      .tz('America/Indiana/Indianapolis') // TZ for property
      .toISOString(true)
      .slice(-6);

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
        createdAt: now,
        currentDueDate: now,
        currentDueDateDay: moment(now * 1000).format('MM/DD/YYYY'),
      },
      inspection,
      item
    );
    const property = mocking.createProperty({ zip: '46077' }); // Indianapolis zip
    const trelloIntegration = mocking.createPropertyTrelloIntegration();
    const trelloResponse = { id: uuid(), shortUrl: 'test.com/img.png' };

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon.stub(systemModel, 'upsertPropertyTrello').resolves();
    sinon.stub(trelloService, 'publishAllCardAttachments').resolves([]);
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    let actual = '';
    sinon
      .stub(trelloService, 'publishListCard')
      .callsFake((listId, authToken, apiKey, payload) => {
        const { due: result } = payload;
        actual = result.slice(-6); // get due date offset
        return Promise.resolve(trelloResponse);
      });

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should not escape the description of the published Trello card', done => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const integrationId = `trello-${propertyId}`;
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
        currentPlanToFix: `I'll test`,
        itemInspectorNotes: `<i>I</i>`,
      },
      inspection,
      item
    );
    const property = mocking.createProperty({ zip: '46077' }); // Indianapolis zip
    const trelloIntegration = mocking.createPropertyTrelloIntegration();
    const trelloResponse = { id: uuid(), shortUrl: 'test.com/image.png' };

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon.stub(systemModel, 'upsertPropertyTrello').resolves();
    sinon.stub(trelloService, 'publishAllCardAttachments').resolves([]);
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    let actual = '';
    sinon
      .stub(trelloService, 'publishListCard')
      .callsFake((listId, authToken, apiKey, payload) => {
        const { desc: result } = payload;
        actual = result.search(/&[#a-z0-9]+;/g);
        return Promise.resolve(trelloResponse);
      });

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(() => {
        expect(actual).to.equal(-1, 'does not contain escape characters');
        done();
      })
      .catch(done);
  });

  it('should submit the expected Trello card description', done => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const integrationId = `trello-${propertyId}`;
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
        itemScore: 1,
        itemInspectorNotes: 'inspector notes',
        currentPlanToFix: 'fix it',
        sectionTitle: 'Title',
        sectionSubtitle: 'Sub Title',
      },
      inspection,
      item
    );
    const property = mocking.createProperty({ zip: '46077' }); // Indianapolis zip
    const trelloIntegration = mocking.createPropertyTrelloIntegration();
    const trelloResponse = { id: uuid(), shortUrl: 'test.com/image.png' };
    const createdAt = new Date(deficiency.createdAt * 1000)
      .toGMTString()
      .split(' ')
      .slice(0, 4)
      .join(' ');
    const expected = `DEFICIENT ITEM (${createdAt})
Score: 1 of 3
Inspector Notes: inspector notes
Plan to fix: fix it
Section: Title
Subtitle: Sub Title

${CLIENT_API_DOMAIN.replace('{{propertyId}}', propertyId).replace(
  '{{deficientItemId}}',
  deficiencyId
)}`;

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon.stub(systemModel, 'upsertPropertyTrello').resolves();
    sinon.stub(trelloService, 'publishAllCardAttachments').resolves([]);
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    let actual = '';
    sinon
      .stub(trelloService, 'publishListCard')
      .callsFake((listId, authToken, apiKey, payload) => {
        actual = payload.desc;
        return Promise.resolve(trelloResponse);
      });

    request(createApp())
      .post(`/t/${deficiencyId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('creates global notifications for trello card creation', async () => {
    const expected = 'Trello card created for Deficient Item';
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const integrationId = `trello-${propertyId}`;
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
        itemScore: 1,
        itemInspectorNotes: 'inspector notes',
        currentPlanToFix: 'fix it',
        sectionTitle: 'Title',
        sectionSubtitle: 'Sub Title',
      },
      inspection,
      item
    );
    const property = mocking.createProperty({ zip: '46077' }); // Indianapolis zip
    const trelloIntegration = mocking.createPropertyTrelloIntegration();
    const trelloResponse = { id: uuid(), shortUrl: 'test.com/image.png' };

    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    sinon
      .stub(integrationsModel, 'findTrello')
      .resolves(createSnapshot('trello'));
    sinon
      .stub(integrationsModel, 'findTrelloProperty')
      .resolves(createSnapshot(integrationId, trelloIntegration));
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(createSnapshot(inspectionId, inspection));
    sinon.stub(systemModel, 'upsertPropertyTrello').resolves();
    sinon.stub(trelloService, 'publishAllCardAttachments').resolves([]);
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    sinon.stub(trelloService, 'publishListCard').resolves(trelloResponse);
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    await request(createApp())
      .post(`/t/${deficiencyId}?notify=true`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { summary: '' }).summary || '';

    expect(actual).to.contain(expected);
  });
});

function createApp() {
  const app = express();
  app.post(
    '/t/:deficiencyId',
    stubAuth,
    stubTrelloReq,
    handler(
      {
        collection: () => {},
        batch: () => ({ commit: () => Promise.resolve() }),
      },
      CLIENT_API_DOMAIN
    )
  );
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

function createSnapshot(id = uuid(), data = null) {
  return {
    exists: Boolean(data),
    id,
    data: () => data,
  };
}
