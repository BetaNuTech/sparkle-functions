const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const deficiencyModel = require('../../../models/deficient-items');
const TRELLO_PUT_CARD_RESPONSE = require('../../../test-helpers/mocks/put-trello-card.json');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Deficient Items | Pubsub | Trello Card Close V2', function() {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(null, fs);
  });

  it("moves a closed deficiency's trello card to the property's trello close list", async () => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const cardId = uuid();
    const closeListId = uuid();
    const status = 'closed';
    const deficiency = mocking.createDeficiency({
      state: status,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
    });
    deficiency.deferredDates = {
      [uuid()]: {
        deferredDate: mocking.nowUnix(),
        deferredDateDay: '11/11/28',
        user: uuid(),
        createdAt: mocking.nowUnix(),
      },
    };
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
    await systemModel.upsertTrello(fs, credentials);
    await systemModel.createTrelloProperty(
      fs,
      propertyId,
      systemTrelloProperty
    );
    await integrationModel.createTrelloProperty(
      fs,
      propertyId,
      intTrelloProperty
    );
    await deficiencyModel.createRecord(fs, deficiencyId, deficiency);

    // Stub Requests
    const cardUpdate = nock('https://api.trello.com')
      .put(`/1/cards/${cardId}`)
      .query({
        key: credentials.apikey,
        token: credentials.authToken,
        idList: closeListId,
        dueComplete: true,
      })
      .reply(200, TRELLO_PUT_CARD_RESPONSE);

    // Execute
    await test.wrap(cloudFunctions.deficiencyTrelloCardClose)(pubSubMessage);

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
    const state = 'closed';
    const deficiency = mocking.createDeficiency({
      state,
      currentPlanToFix: `I'll test`,
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
    const intTrelloProperty = mocking.createPropertyTrelloIntegration({
      closedList: closeListId,
    });
    const systemTrelloProperty = { cards: { [cardId]: deficiencyId } };
    const pubSubMessage = {
      data: Buffer.from(
        `${propertyId}/${deficiencyId}/state/${deficiency.state}`
      ),
    };

    // Setup database
    await systemModel.upsertTrello(fs, credentials);
    await systemModel.createTrelloProperty(
      fs,
      propertyId,
      systemTrelloProperty
    );
    await integrationModel.createTrelloProperty(
      fs,
      propertyId,
      intTrelloProperty
    );
    await deficiencyModel.createRecord(fs, deficiencyId, deficiency);

    // Stub Requests
    nock('https://api.trello.com')
      .put(`/1/cards/${cardId}`)
      .query({
        key: credentials.apikey,
        token: credentials.authToken,
        idList: closeListId,
      })
      .reply(404);

    // Execute
    try {
      await test.wrap(cloudFunctions.deficiencyTrelloCardClose)(pubSubMessage);
    } catch (err) {} // eslint-disable-line no-empty

    // Test Results
    const trelloPropertySnap = await systemModel.findTrelloProperty(
      fs,
      propertyId
    );
    const deficiencySnap = await deficiencyModel.findRecord(fs, deficiencyId);
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
