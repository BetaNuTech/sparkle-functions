const moment = require('moment-timezone');
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
const deficiencyModel = require('../../../models/deficient-items');
const propertyModel = require('../../../models/properties');
const createHandler = require('../../../deficient-items/pubsub/trello-card-due-date-v2');

const INITIAL_STATE = config.deficientItems.initialState;

describe('Deficiencies | Pubsub | Trello Card Due Date V2', function() {
  afterEach(() => sinon.restore());

  it('does not update trello card when deficiency has no trello card', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const status = INITIAL_STATE;
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves('');
    const query = sinon.stub(propertyModel, 'firestoreFindRecord').resolves();

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

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon.stub(systemModel, 'firestoreFindTrello').resolves(createSnapshot());
    const query = sinon.stub(propertyModel, 'firestoreFindRecord').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = query.called;
    expect(actual).to.equal(expected);
  });

  it('does not update trello card when property referenced does not exist', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const cardId = uuid();
    const status = INITIAL_STATE;
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon.stub(propertyModel, 'firestoreFindRecord').resolves(createSnapshot());
    const query = sinon.stub(deficiencyModel, 'firestoreFindRecord').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = query.called;
    expect(actual).to.equal(expected);
  });

  it('does not update trello card when deficiency referenced does not exist', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const cardId = uuid();
    const status = INITIAL_STATE;
    const property = mocking.createProperty();
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(propertyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon
      .stub(deficiencyModel, 'firestoreFindRecord')
      .resolves(createSnapshot());
    const query = sinon.stub(trello, 'updateTrelloCard').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = query.called;
    expect(actual).to.equal(expected);
  });

  it("publishes deficiency's current deferred date as the Trello cards due date", async () => {
    const target = moment.tz('2030-11-18T23:59:59Z', 'America/Chicago'); // TZ for property
    const offset = target.toISOString(true).slice(-6);
    const targetDueIso = `2030-11-18T23:59:59.000${offset}`;
    const expectedUnix = moment(targetDueIso).unix();
    const expectedDate = '11/18/2030';
    const deficiencyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const propertyId = uuid();
    const cardId = uuid();
    const status = 'deferred';
    const now = mocking.nowUnix();
    const property = mocking.createProperty({ zip: '77040' });
    const deficiency = mocking.createDeficiency({
      state: status,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      updatedAt: now,
      currentDueDateDay: null,
      currentDeferredDate: expectedUnix,
      currentDeferredDateDay: expectedDate,
    });
    deficiency.dueDates = {
      current: { createdAt: 1 },
    };
    deficiency.deferredDates = {
      current: { createdAt: now },
    };
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(propertyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon
      .stub(deficiencyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));

    const result = {};
    sinon
      .stub(trello, 'updateTrelloCard')
      .callsFake((actualCardId, authToken, apiKey, payload) => {
        result.cardId = actualCardId;
        result.authToken = authToken;
        result.apiKey = apiKey;
        result.due = payload.due;
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
        actual: `${result.due}`,
        expected: targetDueIso,
        msg: 'sent comment text',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it("publishes deficiency's current due date as the Trello cards due date", async () => {
    const target = moment.tz('2030-11-18T23:59:59Z', 'America/Chicago'); // TZ for property
    const offset = target.toISOString(true).slice(-6);
    const expected = `2030-11-18T23:59:59.000${offset}`;
    const expectedUnix = moment(expected).unix();
    const expectedDate = '11/18/2030';
    const deficiencyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const propertyId = uuid();
    const cardId = uuid();
    const status = 'pending';
    const now = mocking.nowUnix();
    const property = mocking.createProperty({ zip: '77040' });
    const deficiency = mocking.createDeficiency({
      state: status,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      updatedAt: now,
      currentDueDate: expectedUnix,
      currentDueDateDay: expectedDate,
    });
    deficiency.dueDates = {
      current: { createdAt: now },
    };
    deficiency.stateHistory = {
      current: mocking.createDeficiencyStateHistory({
        state: status,
      }),
    };
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(propertyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon
      .stub(deficiencyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));

    let actual = '';
    sinon
      .stub(trello, 'updateTrelloCard')
      .callsFake((actualCardId, authToken, apiKey, payload) => {
        actual = payload.due;
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

  it('removes Trello card due date for a deficiency that enters go-back state', async () => {
    const expected = { due: null, dueComplete: false };
    const deficiencyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const propertyId = uuid();
    const cardId = uuid();
    const status = 'go-back';
    const now = mocking.nowUnix();
    const property = mocking.createProperty({ zip: '77040' });
    const deficiency = mocking.createDeficiency({
      state: status,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      updatedAt: now,
    });
    delete deficiency.currentDueDateDay;
    deficiency.stateHistory = {
      current: mocking.createDeficiencyStateHistory({
        createdAt: now,
        state: status,
      }),
    };
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(propertyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon
      .stub(deficiencyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));

    let actual = null;
    sinon
      .stub(trello, 'updateTrelloCard')
      .callsFake((actualCardId, authToken, apiKey, payload) => {
        actual = payload;
        return Promise.resolve({});
      });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    expect(actual).to.deep.equal(expected);
  });
});
