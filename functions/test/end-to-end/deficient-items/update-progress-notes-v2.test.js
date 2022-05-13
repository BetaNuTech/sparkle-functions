const nock = require('nock');
const hbs = require('handlebars');
const { expect } = require('chai');
const {
  trelloCardDIProgressNoteTemplate,
} = require('../../../config/deficient-items');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const userModel = require('../../../models/users');
const deficiencyModel = require('../../../models/deficient-items');
const systemModel = require('../../../models/system');
const { db, test, cloudFunctions } = require('../../setup');

describe('Deficient Items | Update Progress Notes V2', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
  });

  it("publishes a progress note comment to a Deficiency's Trello Card", async () => {
    const expected = true;
    const cardId = uuid();
    const userId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const progNoteId = uuid();
    const deficiencyData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
      progressNotes: {
        [progNoteId]: {
          startDate: '1/11/25',
          progressNote: 'text',
          user: userId,
          createdAt: now(),
        },
      },
    });
    // Add new progress note
    const defUpdate = {
      [`progressNotes.${uuid()}`]: {
        startDate: '1/11/25',
        progressNote: 'text',
        user: userId,
        createdAt: now() + 1,
      },
    };
    const trelloCredentials = {
      authToken: 'token',
      apikey: 'key',
      user: userId,
    };
    const trelloPropertyData = {
      cards: { [cardId]: deficiencyId },
    };
    const userData = createUser();
    const trelloComment = createTrelloCommentText(userData, 'text');

    // Stup requests
    const commentCreated = nock('https://api.trello.com')
      .post(
        `/1/cards/${cardId}/actions/comments?key=key&token=token&text=${trelloComment}`
      )
      .reply(200, {});

    // Setup database
    await deficiencyModel.createRecord(db, deficiencyId, deficiencyData);
    await systemModel.upsertTrello(db, trelloCredentials);
    await systemModel.createTrelloProperty(db, propertyId, trelloPropertyData);
    await userModel.createRecord(db, userId, userData);
    const beforeSnap = await deficiencyModel.findRecord(db, deficiencyId);
    await deficiencyModel.updateRecord(db, deficiencyId, defUpdate);
    const afterSnap = await deficiencyModel.findRecord(db, deficiencyId);
    const changeSnap = test.makeChange(beforeSnap, afterSnap);

    // Execute
    const wrapped = test.wrap(cloudFunctions.deficientItemsProgressNotesSyncV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Assertions
    const actual = commentCreated.isDone();
    expect(actual).to.equal(expected);
  });

  it('should cleanup references to deleted Trello card from database', async () => {
    const cardId = uuid();
    const userId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const progNoteId = uuid();
    const completedPhotoId = uuid();
    const deficiencyData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
      progressNotes: {
        [progNoteId]: {
          startDate: '1/11/25',
          progressNote: 'text',
          user: userId,
          createdAt: now(),
        },
      },
      completedPhotos: {
        [completedPhotoId]: {
          downloadURL: 'test.com',
          trelloCardAttachement: 'exists',
        },
      },
    });
    // Add new progress note
    const defUpdate = {
      [`progressNotes.${uuid()}`]: {
        startDate: '1/11/25',
        progressNote: 'text',
        user: userId,
        createdAt: now() + 1,
      },
    };
    const trelloCredentials = {
      authToken: 'token',
      apikey: 'key',
      user: userId,
    };
    const trelloPropertyData = {
      cards: { [cardId]: deficiencyId },
    };
    const userData = createUser();
    const trelloComment = createTrelloCommentText(userData, 'text');

    // Stup requests
    nock('https://api.trello.com')
      .post(
        `/1/cards/${cardId}/actions/comments?key=key&token=token&text=${trelloComment}`
      )
      .reply(404, {});

    // Setup database
    await deficiencyModel.createRecord(db, deficiencyId, deficiencyData);
    await systemModel.upsertTrello(db, trelloCredentials);
    await systemModel.createTrelloProperty(db, propertyId, trelloPropertyData);
    await userModel.createRecord(db, userId, userData);
    const beforeSnap = await deficiencyModel.findRecord(db, deficiencyId);
    await deficiencyModel.updateRecord(db, deficiencyId, defUpdate);
    const afterSnap = await deficiencyModel.findRecord(db, deficiencyId);
    const changeSnap = test.makeChange(beforeSnap, afterSnap);

    // Execute
    const wrapped = test.wrap(cloudFunctions.deficientItemsProgressNotesSyncV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test Results
    const trelloPropertySnap = await systemModel.findTrelloProperty(
      db,
      propertyId
    );
    const deficiencySnap = await deficiencyModel.findRecord(db, deficiencyId);
    const deficiency = deficiencySnap.data() || { trelloCardURL: 'test' };
    const completedPhoto = (deficiency.completedPhotos || {})[
      completedPhotoId
    ] || { trelloCardAttachement: 'test' };

    // Assertions
    [
      {
        actual: ((trelloPropertySnap.data() || {}).cards || {})[cardId],
        expected: undefined,
        msg: 'Removed Trello card from systems property data',
      },
      {
        actual: deficiency.trelloCardURL,
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

function createUser(config = {}) {
  return {
    firstName: 'test',
    lastName: 'user',
    email: 'test@user.com',
    ...config,
  };
}

function now() {
  return Math.round(Date.now() / 1000);
}

function createTrelloCommentText(user, text) {
  return encodeURIComponent(
    hbs.compile(trelloCardDIProgressNoteTemplate)({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      progressNote: text,
    })
  );
}
