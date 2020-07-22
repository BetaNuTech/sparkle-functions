const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const systemModel = require('../../../models/system');
const trelloService = require('../../../services/trello');
const createHandler = require('../../../deficient-items/on-update-completed-photo-v2');

describe('Deficiencies | On Update Completed Photo V2', function() {
  afterEach(() => sinon.restore());

  it('should not publish completed photo when completed photos unchanged', async () => {
    const expected = false;
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

    const trelloCardLookup = sinon
      .stub(systemModel, 'firestoreFindTrelloCardId')
      .resolves();

    await createHandler(stubFirestore())(
      {
        before: createSnapshot(deficiencyId, deficiencyData),
        after: createSnapshot(deficiencyId, deficiencyData),
      },
      { params: { deficiencyId } }
    );

    const actual = trelloCardLookup.called;
    expect(actual).to.equal(expected);
  });

  it('should not publish completed photo when deficiency does not have a Trello card', async () => {
    const expected = false;
    const userId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const compPhotoId = uuid();
    const beforeDefData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
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
    // Add new completed photo
    const afterDefData = JSON.parse(JSON.stringify(beforeDefData));
    afterDefData.completedPhotos[uuid()] = {
      startDate: '1/11/25',
      storageDBPath: 'https://test.com',
      downloadURL: 'https://download.com',
      user: userId,
      createdAt: now() + 1,
    };

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves('');
    const credentialsLookup = sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves();

    await createHandler(stubFirestore())(
      {
        before: createSnapshot(deficiencyId, beforeDefData),
        after: createSnapshot(deficiencyId, afterDefData),
      },
      { params: { deficiencyId } }
    );

    const actual = credentialsLookup.called;
    expect(actual).to.equal(expected);
  });

  it('should not publish completed photo when it was already published', async () => {
    const expected = false;
    const userId = uuid();
    const cardId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const compPhotoId = uuid();
    const beforeDefData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
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
    // Add new completed photo
    const afterDefData = JSON.parse(JSON.stringify(beforeDefData));
    afterDefData.completedPhotos[uuid()] = {
      startDate: '1/11/25',
      storageDBPath: 'https://test.com',
      downloadURL: 'https://download.com',
      trelloCardAttachement: '123', // already published
      user: userId,
      createdAt: now() + 1,
    };

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    const credentialsLookup = sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves();

    await createHandler(stubFirestore())(
      {
        before: createSnapshot(deficiencyId, beforeDefData),
        after: createSnapshot(deficiencyId, afterDefData),
      },
      { params: { deficiencyId } }
    );

    const actual = credentialsLookup.called;
    expect(actual).to.equal(expected);
  });

  it('should not attempt to publish completed photo when Trello Credentials have been deleted', async () => {
    const expected = false;
    const userId = uuid();
    const cardId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const compPhotoId = uuid();
    const beforeDefData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
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
    // Add new completed photo
    const afterDefData = JSON.parse(JSON.stringify(beforeDefData));
    afterDefData.completedPhotos[uuid()] = {
      startDate: '1/11/25',
      storageDBPath: 'https://test.com',
      downloadURL: 'https://download.com',
      user: userId,
      createdAt: now() + 1,
    };

    sinon.stub(systemModel, 'firestoreFindTrelloCardId').resolves(cardId);
    sinon
      .stub(systemModel, 'firestoreFindTrello')
      .resolves(createSnapshot('trello'));
    const publishPhoto = sinon
      .stub(trelloService, 'publishCardAttachment')
      .resolves();

    await createHandler(stubFirestore())(
      {
        before: createSnapshot(deficiencyId, beforeDefData),
        after: createSnapshot(deficiencyId, afterDefData),
      },
      { params: { deficiencyId } }
    );

    const actual = publishPhoto.called;
    expect(actual).to.equal(expected);
  });
});

function stubFirestore() {
  return {
    collection: () => {},
    batch: () => ({}),
  };
}

function createSnapshot(id = uuid(), data = null) {
  return {
    exists: Boolean(data),
    id,
    data: () => data,
  };
}

function now() {
  return Math.round(Date.now() / 1000);
}
