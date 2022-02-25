const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const systemModel = require('../../../models/system');
const usersModel = require('../../../models/users');
const createHandler = require('../../../deficient-items/on-update-progress-note-v2');

describe('Deficient Items | On Update Progress Note V2', function() {
  afterEach(() => sinon.restore());

  it('should not publish comment when progress notes unchanged', async () => {
    const expected = false;
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
      progressNotes: {
        [progNoteId]: {
          startDate: '1/11/25',
          progressNote: 'text',
          user: userId,
          createdAt: now(),
        },
      },
    });

    const trelloCardLookup = sinon
      .stub(systemModel, 'findTrelloCardId')
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

  it('should not publish comment when deficiency does not have a Trello card', async () => {
    const expected = false;
    const userId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const progNoteId = uuid();
    const beforeDefData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
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
    const afterDefData = JSON.parse(JSON.stringify(beforeDefData));
    afterDefData.progressNotes[uuid()] = {
      startDate: '1/11/25',
      progressNote: 'text',
      user: userId,
      createdAt: now() + 1,
    };

    sinon.stub(systemModel, 'findTrelloCardId').resolves('');
    const userLookup = sinon.stub(usersModel, 'findRecord').resolves();

    await createHandler(stubFirestore())(
      {
        before: createSnapshot(deficiencyId, beforeDefData),
        after: createSnapshot(deficiencyId, afterDefData),
      },
      { params: { deficiencyId } }
    );

    const actual = userLookup.called;
    expect(actual).to.equal(expected);
  });

  it('should not publish Trello card comment when Progress Note missing author', async () => {
    const expected = false;
    const userId = uuid();
    const cardId = uuid();
    const propertyId = uuid();
    const itemId = uuid();
    const inspectionId = uuid();
    const deficiencyId = uuid();
    const progNoteId = uuid();
    const beforeDefData = mocking.createDeficiency({
      property: propertyId,
      inspection: inspectionId,
      item: itemId,
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
    const afterDefData = JSON.parse(JSON.stringify(beforeDefData));
    afterDefData.progressNotes[uuid()] = {
      startDate: '1/11/25',
      progressNote: 'text',
      user: userId,
      createdAt: now() + 1,
    };

    sinon.stub(systemModel, 'findTrelloCardId').resolves(cardId);
    sinon.stub(usersModel, 'findRecord').resolves(createSnapshot(userId));
    const credentialsLookup = sinon
      .stub(systemModel, 'findTrello')
      .resolves({});

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
