const nock = require('nock');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const trelloTest = require('../../../test-helpers/trello');
const { cleanDb } = require('../../../test-helpers/firebase');
const deferredDiData = require('../../../test-helpers/mocks/deferred-deficient-item');
const TRELLO_POST_ATTACHMENT_CARD_RESPONSE = require('../../../test-helpers/mocks/post-trello-card-attachment');
const {
  db,
  test,
  cloudFunctions,
  uid: SERVICE_ACCOUNT_ID,
} = require('../setup');

const USER_ID = uuid();
const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const TRELLO_CARD_ID = uuid();
const COMPLETED_PHOTO_ID = uuid();
const TRELLO_API_KEY = 'f4a04dd8';
const TRELLO_AUTH_TOKEN = 'fab424b6';
const TRELLO_CREDENTIAL_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_ATTACHMENT_ID = TRELLO_POST_ATTACHMENT_CARD_RESPONSE.id;
const TRELLO_CARD_DATA = { [TRELLO_CARD_ID]: DEFICIENT_ITEM_ID };
const DEFICIENT_ITEM_COMPLETED_PHOTO_URL =
  'https://firebasestorage.googleapis.com/diImage.jpg';
const DEFICIENT_ITEM_DATA = JSON.parse(JSON.stringify(deferredDiData)); // deep clone
const DEFICIENT_ITEM_PATH = `/propertyInspectionDeficientItems/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;
const COMPLETED_PHOTO_PATH = `${DEFICIENT_ITEM_PATH}/completedPhotos/${COMPLETED_PHOTO_ID}`;
DEFICIENT_ITEM_DATA.stateHistory['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.dueDates['-previous'].user = USER_ID;
DEFICIENT_ITEM_DATA.deferredDates['-current'].user = USER_ID;
DEFICIENT_ITEM_DATA.completedPhotos = {};
DEFICIENT_ITEM_DATA.completedPhotos[COMPLETED_PHOTO_ID] = {};
DEFICIENT_ITEM_DATA.completedPhotos[COMPLETED_PHOTO_ID].user = USER_ID;
DEFICIENT_ITEM_DATA.completedPhotos[
  COMPLETED_PHOTO_ID
].downloadURL = DEFICIENT_ITEM_COMPLETED_PHOTO_URL;
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  user: uuid(),
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};

describe('Trello | Create attachment for Deficient Item Completed Photo', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should not make request to Trello API when completed photo is missing data', async () => {
    // Stup requests
    const postPhoto = nock('https://api.trello.com')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&url=${encodeURIComponent(
          DEFICIENT_ITEM_COMPLETED_PHOTO_URL
        )}`
      )
      .reply(200, {});

    // Setup database
    const diData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
    delete diData.completedPhotos[COMPLETED_PHOTO_ID].downloadURL;
    await db.ref(DEFICIENT_ITEM_PATH).set(diData);
    await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
    const changeSnap = await db.ref(COMPLETED_PHOTO_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(
        cloudFunctions.onCreateDeficientItemCompletedPhotoTrelloAttachement
      );
      await wrapped(changeSnap, {
        params: {
          propertyId: PROPERTY_ID,
          deficientItemId: DEFICIENT_ITEM_ID,
          completedPhotoId: COMPLETED_PHOTO_ID,
        },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const actual = postPhoto.isDone();
    expect(actual).to.equal(false);
  });

  it('should not update a trello card when completed photo already has attachemnt', async () => {
    // Stup requests
    const postPhoto = nock('https://api.trello.com')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&url=${encodeURIComponent(
          DEFICIENT_ITEM_COMPLETED_PHOTO_URL
        )}`
      )
      .reply(200, {});

    // Setup database
    const diData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
    diData.completedPhotos[
      COMPLETED_PHOTO_ID
    ].trelloCardAttachement = TRELLO_ATTACHMENT_ID;
    await db.ref(DEFICIENT_ITEM_PATH).set(diData);
    await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
    const changeSnap = await db.ref(COMPLETED_PHOTO_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(
        cloudFunctions.onCreateDeficientItemCompletedPhotoTrelloAttachement
      );
      await wrapped(changeSnap, {
        params: {
          propertyId: PROPERTY_ID,
          deficientItemId: DEFICIENT_ITEM_ID,
          completedPhotoId: COMPLETED_PHOTO_ID,
        },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const actual = postPhoto.isDone();
    expect(actual).to.equal(false);
  });

  it('should update a trello card with new completed photo', async () => {
    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&url=${encodeURIComponent(
          DEFICIENT_ITEM_COMPLETED_PHOTO_URL
        )}`
      )
      .reply(200, TRELLO_POST_ATTACHMENT_CARD_RESPONSE);

    // Setup database
    const diData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
    await db.ref(DEFICIENT_ITEM_PATH).set(diData);
    await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
    const changeSnap = await db.ref(COMPLETED_PHOTO_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(
        cloudFunctions.onCreateDeficientItemCompletedPhotoTrelloAttachement
      );
      await wrapped(changeSnap, {
        params: {
          propertyId: PROPERTY_ID,
          deficientItemId: DEFICIENT_ITEM_ID,
          completedPhotoId: COMPLETED_PHOTO_ID,
        },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const result = await db.ref(COMPLETED_PHOTO_PATH).once('value');
    const actual = Boolean((result.val() || {}).trelloCardAttachement);
    expect(actual).to.equal(true);
  });

  it('should remove all references to completed photo attachments when trello card is removed', async () => {
    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards/${TRELLO_CARD_ID}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}&url=${encodeURIComponent(
          DEFICIENT_ITEM_COMPLETED_PHOTO_URL
        )}`
      )
      .reply(404, TRELLO_POST_ATTACHMENT_CARD_RESPONSE);

    // Setup database
    const attachmentId = uuid();
    const diData = JSON.parse(JSON.stringify(DEFICIENT_ITEM_DATA));
    diData.completedPhotos[uuid()] = {
      user: USER_ID,
      trelloCardAttachement: attachmentId, // previously uploaded attachement
    };
    await db.ref(DEFICIENT_ITEM_PATH).set(diData);
    await db.ref(TRELLO_CREDENTIAL_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(TRELLO_CARDS_PATH).set(TRELLO_CARD_DATA);
    const changeSnap = await db.ref(COMPLETED_PHOTO_PATH).once('value');

    // Execute
    try {
      const wrapped = test.wrap(
        cloudFunctions.onCreateDeficientItemCompletedPhotoTrelloAttachement
      );
      await wrapped(changeSnap, {
        params: {
          propertyId: PROPERTY_ID,
          deficientItemId: DEFICIENT_ITEM_ID,
          completedPhotoId: COMPLETED_PHOTO_ID,
        },
      });
    } catch (err) {} // eslint-disable-line no-empty

    // Assertions
    const actual = await trelloTest.hasAddTrelloAttachmentId(
      db,
      DEFICIENT_ITEM_PATH,
      attachmentId
    );
    expect(actual).to.equal(false);
  });
});
