const moment = require('moment-timezone');
const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const deficiencyModel = require('../../../models/deficient-items');
const propertyModel = require('../../../models/properties');
const TRELLO_PUT_CARD_RESPONSE = require('../../../test-helpers/mocks/put-trello-card.json');
const { db, test, cloudFunctions } = require('../../setup');

describe('Deficient Items | Pubsub | Trello Card Due Date V2', function() {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
  });

  it("moves a closed deficiency's trello card to the property's trello close list", async () => {
    const target = moment.tz('2030-11-18T23:59:59Z', 'America/Chicago'); // TZ for property
    const offset = target.toISOString(true).slice(-6);
    const expected = `2030-11-18T23:59:59.000${offset}`;
    const expectedUnix = moment(expected).unix();
    const expectedDate = '11/18/2030';
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const cardId = uuid();
    const closeListId = uuid();
    const status = 'pending';
    const now = mocking.nowUnix();
    const deficiency = mocking.createDeficiency({
      state: status,
      updatedAt: now,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      currentDueDate: expectedUnix,
      currentDueDateDay: expectedDate,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
    });
    deficiency.dueDates = {
      current: {
        startDate: now,
        dueDate: expectedUnix,
        dueDateDay: expectedDate,
        user: uuid(),
        createdAt: now,
      },
    };
    const property = mocking.createProperty({ zip: '77040' });
    const intTrelloProperty = mocking.createPropertyTrelloIntegration({
      closedList: closeListId,
    });
    const systemTrelloProperty = { cards: { [cardId]: deficiencyId } };
    const credentials = mocking.createTrelloCredentials();
    const pubSubMessage = {
      data: Buffer.from(
        `${propertyId}/${deficiencyId}/state/${deficiency.state}`
      ),
    };

    // Setup database
    await propertyModel.createRecord(db, propertyId, property);
    await systemModel.upsertTrello(db, credentials);
    await systemModel.createTrelloProperty(
      db,
      propertyId,
      systemTrelloProperty
    );
    await integrationModel.createTrelloProperty(
      db,
      propertyId,
      intTrelloProperty
    );
    await deficiencyModel.createRecord(db, deficiencyId, deficiency);

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(`/1/cards/${cardId}`)
      .query({
        key: credentials.apikey,
        token: credentials.authToken,
        due: expected,
        dueComplete: false,
      })
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

    // Execute
    await test.wrap(cloudFunctions.deficiencyTrelloCardDueDates)(pubSubMessage);

    // Assertion
    // Throws error if request not performed
    return cardUpdate.done();
  });

  it('should cleanup references to deleted Trello card from database', async () => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const cardId = uuid();
    const compPhotoId = uuid();
    const credentials = mocking.createTrelloCredentials();
    const closeListId = uuid();
    const state = 'go-back';
    const now = mocking.nowUnix();
    const deficiency = mocking.createDeficiency({
      state,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
      completedPhotos: {
        [compPhotoId]: {
          downloadURL: 'test.com',
          trelloCardAttachement: 'exists',
        },
      },
    });
    delete deficiency.currentDueDateDay;
    deficiency.stateHistory = {
      current: mocking.createDeficiencyStateHistory({
        createdAt: now,
        state,
      }),
    };
    const property = mocking.createProperty({ zip: '77040' });
    const intTrelloProperty = mocking.createPropertyTrelloIntegration({
      closedList: closeListId,
    });
    const systemTrelloProperty = { cards: { [cardId]: deficiencyId } };
    const pubSubMessage = {
      data: Buffer.from(`${propertyId}/${deficiencyId}/state/${state}`),
    };

    // Setup database
    await propertyModel.createRecord(db, propertyId, property);
    await systemModel.upsertTrello(db, credentials);
    await systemModel.createTrelloProperty(
      db,
      propertyId,
      systemTrelloProperty
    );
    await integrationModel.createTrelloProperty(
      db,
      propertyId,
      intTrelloProperty
    );
    await deficiencyModel.createRecord(db, deficiencyId, deficiency);

    // Stub Requests
    nock('https://api.trello.com')
      .put(`/1/cards/${cardId}`)
      .query(() => true)
      .reply(404);

    // Execute
    try {
      await test.wrap(cloudFunctions.deficiencyTrelloCardDueDates)(
        pubSubMessage
      );
    } catch (err) {} // eslint-disable-line no-empty

    // Test Results
    const trelloPropertySnap = await systemModel.findTrelloProperty(
      db,
      propertyId
    );
    const deficiencySnap = await deficiencyModel.findRecord(db, deficiencyId);
    const deficiencyResults = deficiencySnap.data() || {
      trelloCardURL: 'test',
    };
    const completedPhoto = (deficiencyResults.completedPhotos || {})[
      compPhotoId
    ] || {
      trelloCardAttachement: 'test',
    };

    // Assertions
    [
      {
        actual: ((trelloPropertySnap.data() || {}).cards || {})[cardId],
        expected: undefined,
        msg: 'Removed Trello card from systems property data',
      },
      {
        actual: deficiencyResults.trelloCardURL,
        expected: undefined,
        msg: 'Removed Trello card url from systems property data',
      },
      {
        actual: completedPhoto.trelloCardAttachement,
        expected: undefined,
        msg: 'Removed Trello card attachemnt from completed photo',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
