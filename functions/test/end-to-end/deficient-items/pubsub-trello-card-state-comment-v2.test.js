const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const usersModel = require('../../../models/users');
const deficiencyModel = require('../../../models/deficient-items');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Deficiency | Pubsub | Trello Card State Comment', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(null, fs);
  });

  it("should append state transition comment to a deficient items' Trello card", async () => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const userId = uuid();
    const cardId = uuid();
    const user = mocking.createUser();
    const credentials = mocking.createTrelloCredentials();
    const oldState = 'overdue';
    const state = 'requires-progress-update';
    const deficiency = mocking.createDeficiency({
      state,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
    });
    deficiency.stateHistory = {
      [uuid()]: mocking.createDeficiencyStateHistory({
        state,
        user: userId,
        createdAt: mocking.nowUnix(), // newest
      }),
      [uuid()]: mocking.createDeficiencyStateHistory({
        state: oldState,
        user: userId,
        createdAt: mocking.nowUnix() - 10000, // oldest
      }),
    };
    const trelloProperty = { cards: { [cardId]: deficiencyId } };
    const pubSubMessage = {
      data: Buffer.from(
        `${propertyId}/${deficiencyId}/state/${deficiency.state}`
      ),
    };

    // Setup database
    await systemModel.firestoreUpsertTrello(fs, credentials);
    await systemModel.firestoreCreateTrelloProperty(
      fs,
      propertyId,
      trelloProperty
    );
    await deficiencyModel.firestoreCreateRecord(fs, deficiencyId, deficiency);
    await usersModel.firestoreCreateRecord(fs, userId, user);

    // Stub Requests
    let commentTxt = '';
    const commentCreated = nock('https://api.trello.com')
      .post(`/1/cards/${cardId}/actions/comments`)
      .query(query => {
        commentTxt = decodeURIComponent(query.text);
        query.text = 'test';
        return true;
      })
      .reply(200, {});

    // Execute
    await test.wrap(cloudFunctions.deficiencyTrelloCardStateComments)(
      pubSubMessage
    );

    // Assertions
    [
      {
        actual: commentCreated.isDone(),
        expected: true,
        msg: 'Set POST request to Trello API',
      },
      {
        actual:
          commentTxt.search(user.firstName) > -1 &&
          commentTxt.search(user.lastName) > -1,
        expected: true,
        msg: "Trello comment includes status author's name",
      },
      {
        actual: commentTxt.search(user.email) > -1,
        expected: true,
        msg: "Trello comment includes status author's email",
      },
      {
        actual: commentTxt.toLowerCase().search(state) > -1,
        expected: true,
        msg: 'Trello comment includes new deficiency state',
      },
      {
        actual: commentTxt.toLowerCase().search(oldState) > -1,
        expected: true,
        msg: 'Trello comment includes previous deficiency state',
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it("should not escape any characters of a new state transition comment for a deficient items' Trello card", async () => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const userId = uuid();
    const cardId = uuid();
    const user = mocking.createUser();
    const credentials = mocking.createTrelloCredentials();
    const state = 'pending';
    const oldState = 'go-back';
    const deficiency = mocking.createDeficiency({
      state,
      currentPlanToFix: `I'll test`,
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
    });
    deficiency.stateHistory = {
      current: mocking.createDeficiencyStateHistory({
        state,
        user: userId,
        createdAt: mocking.nowUnix(),
      }),
      previous: mocking.createDeficiencyStateHistory({
        user: userId,
        state: oldState,
        createdAt: mocking.nowUnix() - 10000,
      }),
    };
    const trelloProperty = { cards: { [cardId]: deficiencyId } };
    const pubSubMessage = {
      data: Buffer.from(
        `${propertyId}/${deficiencyId}/state/${deficiency.state}`
      ),
    };

    // Stub Requests
    nock('https://api.trello.com')
      .post(uri => {
        const actual = decodeURIComponent(uri).search(/&[#a-z0-9]+;/g);
        expect(actual).to.equal(-1, 'found HTML symbol in payload');
        return uri;
      })
      .reply(201, {});

    // Setup database
    await systemModel.firestoreUpsertTrello(fs, credentials);
    await systemModel.firestoreCreateTrelloProperty(
      fs,
      propertyId,
      trelloProperty
    );
    await deficiencyModel.firestoreCreateRecord(fs, deficiencyId, deficiency);
    await usersModel.firestoreCreateRecord(fs, userId, user);

    // Execute
    await test.wrap(cloudFunctions.deficiencyTrelloCardStateComments)(
      pubSubMessage
    );
  });

  it('should cleanup references to deleted Trello card from database', async () => {
    const deficiencyId = uuid();
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const userId = uuid();
    const cardId = uuid();
    const compPhotoId = uuid();
    const user = mocking.createUser();
    const credentials = mocking.createTrelloCredentials();
    const state = 'pending';
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
    deficiency.stateHistory = {
      [uuid()]: mocking.createDeficiencyStateHistory({
        state,
        user: userId,
      }),
    };
    const trelloProperty = { cards: { [cardId]: deficiencyId } };
    const pubSubMessage = {
      data: Buffer.from(
        `${propertyId}/${deficiencyId}/state/${deficiency.state}`
      ),
    };

    // Setup database
    await systemModel.firestoreUpsertTrello(fs, credentials);
    await systemModel.firestoreCreateTrelloProperty(
      fs,
      propertyId,
      trelloProperty
    );
    await deficiencyModel.firestoreCreateRecord(fs, deficiencyId, deficiency);
    await usersModel.firestoreCreateRecord(fs, userId, user);

    // Stub Requests
    nock('https://api.trello.com')
      .post(`/1/cards/${cardId}/actions/comments`)
      .query(() => true)
      .reply(404);

    // Execute
    try {
      await test.wrap(cloudFunctions.deficiencyTrelloCardStateComments)(
        pubSubMessage
      );
    } catch (err) {} // eslint-disable-line no-empty

    // Test Results
    const trelloPropertySnap = await systemModel.firestoreFindTrelloProperty(
      fs,
      propertyId
    );
    const deficiencySnap = await deficiencyModel.firestoreFindRecord(
      fs,
      deficiencyId
    );
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
