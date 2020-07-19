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
const usersModel = require('../../../models/users');
const deficiencyModel = require('../../../models/deficient-items');
const createHandler = require('../../../deficient-items/pubsub/trello-card-state-comment-v2');

const INITIAL_STATE = config.deficientItems.initialState;

describe('Deficiencies | Pubsub | Trello Card Status Comment V2', function() {
  afterEach(() => sinon.restore());

  it('should not create comment when deficiency has no trello card', async () => {
    const expected = false;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const status = INITIAL_STATE;
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves('');
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

  it('should not create comment when Trello credentials are not setup', async () => {
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

  it("should append state transition comment to a deficiency's Trello card", async () => {
    const expected = true;
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const userId = uuid();
    const cardId = uuid();
    const user = mocking.createUser();
    const deficiency = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
    });
    const stateHistId = uuid();
    deficiency.stateHistory = {
      [stateHistId]: mocking.createDeficiencyStateHistory({ user: userId }),
    };
    const status = deficiency.stateHistory[stateHistId].state;
    const credentials = mocking.createTrelloCredentials();
    const message = Buffer.from(
      `${propertyId}/${deficiencyId}/status/${status}`
    ).toString('base64');

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello', credentials));
    sinon
      .stub(deficiencyModel, 'firestoreFindRecord')
      .resolves(createSnapshot(deficiencyId, deficiency));
    sinon
      .stub(usersModel, 'firestoreFindRecord')
      .resolves(createSnapshot(userId, user));
    const publish = sinon.stub(trello, 'publishTrelloCardComment').resolves();

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic',
      createMessagingStub()
    );

    const actual = publish.called;
    expect(actual).to.equal(expected);
  });
});
