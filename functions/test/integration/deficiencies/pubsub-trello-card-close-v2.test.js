const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const {
  createFirestore,
  createSnapshot,
  createPubSubHandler,
  createMessagingStub,
} = require('../../../test-helpers/stubs');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const trello = require('../../../services/trello');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const deficiencyModel = require('../../../models/deficient-items');
const createHandler = require('../../../deficient-items/pubsub/trello-card-close-v2');

const INITIAL_STATE = config.deficientItems.initialState;

describe('Deficient Items | Pubsub | Trello Card Close V2', function() {
  afterEach(() => sinon.restore());

  it('does not update trello card when deficiency has no trello card', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const status = INITIAL_STATE;
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    const query = sinon.stub(deficiencyModel, 'findRecord').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = query.called;
    expect(actual).to.equal(expected);
  });

  it('does not update trello card when Trello credentials are not setup', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const cardId = uuid();
    const status = INITIAL_STATE;
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'findTrelloCardId').resolves(cardId);
    sinon.stub(systemModel, 'findTrello').resolves(createSnapshot());
    const query = sinon.stub(deficiencyModel, 'findRecord').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = query.called;
    expect(actual).to.equal(expected);
  });

  it('does not make Trello API request when deficiency is not closed or due', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const cardId = uuid();
    const status = INITIAL_STATE;
    const deficiency = mocking.createDeficiency({
      state: status,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
    });
    const trelloProperty = mocking.createPropertyTrelloIntegration();
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'findTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'findTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(integrationModel, 'findTrelloProperty')
      .resolves(createSnapshot(`trello-${propertyId}`, trelloProperty));
    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    const publish = sinon.stub(trello, 'updateTrelloCard').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = publish.called;
    expect(actual).to.equal(expected);
  });

  it("moves closed deficiency's trello card to closed list", async () => {
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
    const trelloProperty = mocking.createPropertyTrelloIntegration({
      closedList: closeListId,
    });
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'findTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'findTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(integrationModel, 'findTrelloProperty')
      .resolves(createSnapshot(`trello-${propertyId}`, trelloProperty));
    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    const result = {};
    sinon
      .stub(trello, 'updateTrelloCard')
      .callsFake((actualCardId, authToken, apiKey, updates) => {
        result.cardId = actualCardId;
        result.authToken = authToken;
        result.apiKey = apiKey;
        Object.assign(result, updates);
        return Promise.resolve({});
      });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    [
      {
        actual: result.cardId,
        expected: cardId,
        msg: 'updated requested card',
      },
      {
        actual: result.authToken,
        expected: credentials.authToken,
        msg: 'updated using system Trello auth token',
      },
      {
        actual: result.apiKey,
        expected: credentials.apikey,
        msg: 'updated using system Trello api key',
      },
      {
        actual: result.idList,
        expected: closeListId,
        msg: 'updated using close list integration',
      },
      {
        actual: result.dueComplete,
        expected: undefined,
        msg: 'did not attempt to update card due date',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it("removes a deficiency's due date when previously deferred", async () => {
    const expected = true;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const cardId = uuid();
    const closeListId = uuid();
    const status = 'completed';
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
    const trelloProperty = mocking.createPropertyTrelloIntegration({
      closedList: closeListId,
    });
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'findTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'findTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(integrationModel, 'findTrelloProperty')
      .resolves(createSnapshot(`trello-${propertyId}`, trelloProperty));
    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    let actual;
    sinon
      .stub(trello, 'updateTrelloCard')
      .callsFake((actualCardId, authToken, apiKey, updates) => {
        actual = updates.dueComplete;
        return Promise.resolve({});
      });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    expect(actual).to.equal(expected);
  });
});
