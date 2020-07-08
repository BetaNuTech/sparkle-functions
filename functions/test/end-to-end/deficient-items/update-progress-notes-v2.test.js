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
const deferredDiData = require('../../../test-helpers/mocks/deferred-deficient-item');
const { fs, test, cloudFunctions } = require('../../setup');

const USER_ID = uuid();
const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const PROGRESS_NOTE_ID = uuid();
const TRELLO_CARD_ID = uuid();
const TRELLO_API_KEY = '2342afab';
const TRELLO_AUTH_TOKEN = '909adfjsd';
const TRELLO_CREDENTIAL_PATH = `/system/integrations/trello/organization`;
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  user: uuid(),
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const TRELLO_CARDS_PATH = `/system/integrations/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_CARD_DATA = { [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID };
const DEFICIENT_ITEM_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const PROGRESS_NOTE_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}/progressNotes/${PROGRESS_NOTE_ID}`;
const DEFICIENT_ITEM_DATA = JSON.parse(JSON.stringify(deferredDiData)); // deep clone
DEFICIENT_ITEM_DATA.progressNotes = {
  [PROGRESS_NOTE_ID]: {
    startDate: Math.round(Date.now() / 1000),
    createdAt: Math.round(Date.now() / 1000),
    progressNote: 'test note',
    user: USER_ID,
  },
};
const USER_PATH = `/users/${USER_ID}`;
const USER_DATA = {
  admin: true,
  corporate: false,
  email: 'testor@bluestone-prop.com',
  firstName: 'Test',
  lastName: 'User',
};

describe('Deficiency | Update Progress Notes V2', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(null, fs);
  });

  it('should not publish comment when progress notes unchanged', async () => {
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
      progressNotes: {
        [progNoteId]: {
          startDate: '1/11/25',
          progressNote: 'text',
          user: userId,
          createdAt: now(),
        },
      },
    });
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
    await deficiencyModel.firestoreCreateRecord(
      fs,
      deficiencyId,
      deficiencyData
    );
    await systemModel.firestoreUpsertTrello(fs, trelloCredentials);
    await systemModel.firestoreCreateTrelloProperty(
      fs,
      propertyId,
      trelloPropertyData
    );
    await userModel.firestoreCreateRecord(fs, userId, userData);
    const beforeSnap = await deficiencyModel.firestoreFindRecord(
      fs,
      deficiencyId
    );
    await deficiencyModel.firestoreUpdateRecord(fs, deficiencyId, {
      updatedAt: now(),
    });
    const afterSnap = await deficiencyModel.firestoreFindRecord(
      fs,
      deficiencyId
    );
    const changeSnap = test.makeChange(beforeSnap, afterSnap);

    // Execute
    const wrapped = test.wrap(cloudFunctions.deficientItemsProgressNotesSyncV2);
    await wrapped(changeSnap, { params: { deficiencyId } });

    // Assertions
    const actual = commentCreated.isDone();
    expect(actual).to.equal(false);
  });

  // it('should not make request to Trello API when Progress Note lacks user', async () => {
  //   // Stup requests
  //   const commentCreated = nock('https://api.trello.com')
  //     .post(
  //       `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
  //     )
  //     .reply(200, {});
  //
  //   // Setup database
  //   const diData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
  //   delete diData.progressNotes[PROGRESS_NOTE_ID].user;
  //   await db.ref(DEFICIENT_ITEM_PATH).set(diData);
  //   await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
  //   await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
  //   await db.ref(USER_PATH).set(USER_DATA);
  //   const changeSnap = await db.ref(PROGRESS_NOTE_PATH).once('value');
  //
  //   // Execute
  //   try {
  //     const wrapped = test.wrap(
  //       cloudFunctions.onCreateDeficientItemProgressNoteTrelloComment
  //     );
  //     await wrapped(changeSnap, {
  //       params: {
  //         propertyId: PROPERTY_ID,
  //         deficientItemId: DEFICIENT_ITEM_ID,
  //         progressNoteId: PROGRESS_NOTE_ID,
  //       },
  //     });
  //   } catch (err) {} // eslint-disable-line no-empty
  //
  //   // Assertions
  //   const actual = commentCreated.isDone();
  //   expect(actual).to.equal(false);
  // });
  //
  // it('should not make request to Trello API when Deficient Item has no Trello Card', async () => {
  //   // Stup requests
  //   const commentCreated = nock('https://api.trello.com')
  //     .post(
  //       `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
  //     )
  //     .reply(200, {});
  //
  //   // Setup database
  //   await db.ref(USER_PATH).set(USER_DATA);
  //   await db.ref(DEFICIENT_ITEM_PATH).set(DEFICIENT_ITEM_DATA);
  //   await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
  //   const changeSnap = await db.ref(PROGRESS_NOTE_PATH).once('value');
  //
  //   // Execute
  //   try {
  //     const wrapped = test.wrap(
  //       cloudFunctions.onCreateDeficientItemProgressNoteTrelloComment
  //     );
  //     await wrapped(changeSnap, {
  //       params: {
  //         propertyId: PROPERTY_ID,
  //         deficientItemId: DEFICIENT_ITEM_ID,
  //         progressNoteId: PROGRESS_NOTE_ID,
  //       },
  //     });
  //   } catch (err) {} // eslint-disable-line no-empty
  //
  //   // Assertions
  //   const actual = commentCreated.isDone();
  //   expect(actual).to.equal(false);
  // });
  //
  // it('should not make request to Trello API when Progress Note author does not exist', async () => {
  //   // Stup requests
  //   const commentCreated = nock('https://api.trello.com')
  //     .post(
  //       `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=test`
  //     )
  //     .reply(200, {});
  //
  //   // Setup database
  //   await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
  //   await db.ref(DEFICIENT_ITEM_PATH).set(DEFICIENT_ITEM_DATA);
  //   await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
  //   const changeSnap = await db.ref(PROGRESS_NOTE_PATH).once('value');
  //
  //   // Execute
  //   try {
  //     const wrapped = test.wrap(
  //       cloudFunctions.onCreateDeficientItemProgressNoteTrelloComment
  //     );
  //     await wrapped(changeSnap, {
  //       params: {
  //         propertyId: PROPERTY_ID,
  //         deficientItemId: DEFICIENT_ITEM_ID,
  //         progressNoteId: PROGRESS_NOTE_ID,
  //       },
  //     });
  //   } catch (err) {} // eslint-disable-line no-empty
  //
  //   // Assertions
  //   const actual = commentCreated.isDone();
  //   expect(actual).to.equal(false);
  // });
  //
  // it("should publish a progress note comment to the Deficient Item's Trello Card", async () => {
  //   // Stup requests
  //   const comment = hbs.compile(trelloCardDIProgressNoteTemplate)({
  //     firstName: USER_DATA.firstName,
  //     lastName: USER_DATA.lastName,
  //     email: USER_DATA.email,
  //     progressNote:
  //       DEFICIENT_ITEM_DATA.progressNotes[PROGRESS_NOTE_ID].progressNote,
  //   });
  //   const commentCreated = nock('https://api.trello.com')
  //     .post(
  //       `/1/cards/${TRELLO_CARD_ID}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&text=${encodeURIComponent(
  //         comment
  //       )}`
  //     )
  //     .reply(200, {});
  //
  //   // Setup database
  //   await db.ref(USER_PATH).set(USER_DATA);
  //   await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
  //   await db.ref(DEFICIENT_ITEM_PATH).set(DEFICIENT_ITEM_DATA);
  //   await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
  //   const changeSnap = await db.ref(PROGRESS_NOTE_PATH).once('value');
  //
  //   // Execute
  //   try {
  //     const wrapped = test.wrap(
  //       cloudFunctions.onCreateDeficientItemProgressNoteTrelloComment
  //     );
  //     await wrapped(changeSnap, {
  //       params: {
  //         propertyId: PROPERTY_ID,
  //         deficientItemId: DEFICIENT_ITEM_ID,
  //         progressNoteId: PROGRESS_NOTE_ID,
  //       },
  //     });
  //   } catch (err) {} // eslint-disable-line no-empty
  //
  //   // Assertions
  //   const actual = commentCreated.isDone();
  //   expect(actual).to.equal(true);
  // });
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
