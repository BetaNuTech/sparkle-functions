const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const deficiencyModel = require('../../../models/deficient-items');
const systemModel = require('../../../models/system');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Deficiency | Update Completed Photo V2', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(null, fs);
  });

  it("publishes a completed photo to a Deficiency's Trello Card", async () => {
    const cardId = uuid();
    const userId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const compPhotoId = uuid();
    const newCompPhotoId = uuid();
    const attachmentId = uuid();
    const deficiencyData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
      trelloCardURL: `https://trello.com/cards/${cardId}`,
      completedPhotos: {
        [compPhotoId]: {
          startDate: '1/11/25',
          user: userId,
          createdAt: now(),
          storageDBPath: 'https://test.com',
          downloadURL: 'https://download.com',
        },
      },
    });
    // Add new progress note
    const defUpdate = {
      [`completedPhotos.${newCompPhotoId}`]: {
        startDate: '1/11/25',
        storageDBPath: 'https://test.com',
        downloadURL: 'https://download.com',
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
    const trelloText = createTrelloUrlAttachment(
      userData,
      'https://download.com'
    );

    // Stup requests
    const postPhoto = nock('https://api.trello.com')
      .post(
        `/1/cards/${cardId}/attachments?key=key&token=token&url=${trelloText}`
      )
      .reply(200, { id: attachmentId });

    // Setup database
    await deficiencyModel.createRecord(fs, deficiencyId, deficiencyData);
    await systemModel.upsertTrello(fs, trelloCredentials);
    await systemModel.createTrelloProperty(fs, propertyId, trelloPropertyData);
    const beforeSnap = await deficiencyModel.findRecord(fs, deficiencyId);
    await deficiencyModel.updateRecord(fs, deficiencyId, defUpdate);
    const afterSnap = await deficiencyModel.findRecord(fs, deficiencyId);
    const changeSnap = test.makeChange(beforeSnap, afterSnap);

    // Execute
    const wrapped = test.wrap(cloudFunctions.deficiencyUpdateCompletedPhotos);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test Results
    const deficiencySnap = await deficiencyModel.findRecord(fs, deficiencyId);
    const completedPhoto =
      ((deficiencySnap.data() || {}).completedPhotos || {})[newCompPhotoId] ||
      {};

    // Assertions
    [
      {
        actual: postPhoto.isDone(),
        expected: true,
        msg: 'completed POST to Trello API',
      },
      {
        actual: completedPhoto.trelloCardAttachement,
        expected: attachmentId,
        msg: 'Set trello card attachement ID to deficiency',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should cleanup references to deleted Trello card from database', async () => {
    const cardId = uuid();
    const userId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const compPhotoId = uuid();
    const deficiencyData = mocking.createDeficiency({
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
    // Add new progress note
    const defUpdate = {
      [`completedPhotos.${uuid()}`]: {
        startDate: '1/11/25',
        storageDBPath: 'https://test.com',
        downloadURL: 'https://download.com',
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
    const trelloText = createTrelloUrlAttachment(
      userData,
      'https://download.com'
    );

    // Stup requests
    nock('https://api.trello.com')
      .post(
        `/1/cards/${cardId}/attachments?key=key&token=token&url=${trelloText}`
      )
      .reply(404, {});

    // Setup database
    await deficiencyModel.createRecord(fs, deficiencyId, deficiencyData);
    await systemModel.upsertTrello(fs, trelloCredentials);
    await systemModel.createTrelloProperty(fs, propertyId, trelloPropertyData);
    const beforeSnap = await deficiencyModel.findRecord(fs, deficiencyId);
    await deficiencyModel.updateRecord(fs, deficiencyId, defUpdate);
    const afterSnap = await deficiencyModel.findRecord(fs, deficiencyId);
    const changeSnap = test.makeChange(beforeSnap, afterSnap);

    // Execute
    const wrapped = test.wrap(cloudFunctions.deficiencyUpdateCompletedPhotos);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Test Results
    const trelloPropertySnap = await systemModel.findTrelloProperty(
      fs,
      propertyId
    );
    const deficiencySnap = await deficiencyModel.findRecord(fs, deficiencyId);
    const deficiency = deficiencySnap.data() || { trelloCardURL: 'test' };
    const completedPhoto = (deficiency.completedPhotos || {})[compPhotoId] || {
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

function createTrelloUrlAttachment(user, url) {
  return encodeURIComponent(url);
}
