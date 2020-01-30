const { expect } = require('chai');
const request = require('supertest');
const nock = require('nock');
const moment = require('moment-timezone');
const appConfig = require('../../../config');
const createTrelloDeficientItemCardHandler = require('../../../trello/create-trello-deficient-item-card-handler');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb, stubFirbaseAuth } = require('../../../test-helpers/firebase');
const { db, uid: SERVICE_ACCOUNT_ID } = require('../setup');
const trelloCardPayload = require('../../../test-helpers/mocks/post-trello-card.json');

const PROPERTY_ID = uuid();
const DEFICIENT_ITEM_ID = uuid();
const INSPECTION_ID = uuid();
const ITEM_ID = uuid();
const USER_ID = uuid();
const TRELLO_MEMBER_ID = uuid();
const USER = { admin: true, corporate: true };
const TRELLO_API_KEY = '3aac9516965';
const TRELLO_AUTH_TOKEN = '2a0ecf16ceb';
const TRELLO_BOARD_ID = '5d0ab7754066f880369a4d97';
const TRELLO_LIST_ID = '5d0ab7754066f880369a4d99';
const API_PATH = `/properties/${PROPERTY_ID}/deficient-items/${DEFICIENT_ITEM_ID}/trello/card`;
const CLIENT_APP_URI_TEMPL = appConfig.clientApps.web.deficientItemURL;
const PROPERTY_DATA = { zip: '47715' }; // TZ = "America/Indiana/Indianapolis"
const NOW = Date.now();
const DEFICIENT_ITEM_DATA = {
  createdAt: NOW / 1000,
  currentDueDate: NOW / 1000,
  currentDueDateDay: moment(NOW).format('MM/DD/YYYY'),
  itemTitle: 'Broken Pipe',
  itemScore: 4,
  itemInspectorNotes: 'a lot of rust around pipe',
  currentPlanToFix: 'replace pipe completely',
  inspection: INSPECTION_ID,
  item: ITEM_ID,
  sectionTitle: 'Title',
  sectionSubtitle: 'Sub Title',
};
const TRELLO_SYSTEM_INTEGRATION_DATA = {
  user: USER_ID,
  apikey: TRELLO_API_KEY,
  authToken: TRELLO_AUTH_TOKEN,
};
const TRELLO_INTEGRATION_DATA = {
  createdAt: NOW / 1000,
  updatedAt: NOW / 1000,
  member: TRELLO_MEMBER_ID,
  trelloUsername: 'test-user',
};
const INSPECTION_ITEM_DATA = {
  mainInputFourValue: 0,
  mainInputOneValue: 2,
  mainInputThreeValue: 3,
  mainInputTwoValue: 0,
  mainInputZeroValue: 1,
};
const INTEGRATIONS_DATA = {
  grantedBy: USER_ID,
  grantedAt: NOW / 1000,
  openBoard: TRELLO_BOARD_ID,
  openBoardName: 'Test Board',
  openList: TRELLO_LIST_ID,
  openListName: 'TO DO',
};
const TRELLO_CREDENTIAL_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/organization`;
const TRELLO_CARDS_DB_PATH = `/system/integrations/${SERVICE_ACCOUNT_ID}/trello/properties/${PROPERTY_ID}/cards`;
const TRELLO_INTEGRATIONS_DB_PATH = `/integrations/trello/properties/${PROPERTY_ID}`;
const TRELLO_ORG_INTEGRATION_DB_PATH = '/integrations/trello/organization';
const DEFICIENT_ITEM_DB_PATH = `${appConfig.deficientItems.dbPath}/${PROPERTY_ID}/${DEFICIENT_ITEM_ID}`;

describe('Trello Create Deficient Item Cards', () => {
  afterEach(async () => {
    nock.cleanAll();
    await cleanDb(db);
    return db.ref(`/system/integrations/${SERVICE_ACCOUNT_ID}`).remove();
  });

  it('should send forbidden error when property has no trello auth credentials', async () => {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(403);

    // Assertions
    expect(result.body.message).to.equal('Error accessing trello token');
  });

  it('should return conflict error when requested deficient item does not exist', async () => {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'Requested property or deficient item could not be found'
    );
  });

  it('should return conflict error when no trello board and/or open list is configured for property', async () => {
    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'Trello integration details for property not found or invalid'
    );
  });

  it('should return an error when attempting to create duplicate cards', async () => {
    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, trelloCardPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db
      .ref(TRELLO_CARDS_DB_PATH)
      .set({ 'trello-card-id': DEFICIENT_ITEM_ID });
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(409);

    // Assertions
    expect(result.body.message).to.equal(
      'Deficient Item already has published Trello Card'
    );
  });

  it('should succesfully create a trello card for the deficient item with expected details', async () => {
    const createdAt = new Date(DEFICIENT_ITEM_DATA.createdAt * 1000)
      .toGMTString()
      .split(' ')
      .slice(0, 4)
      .join(' ');
    const expected = `DEFICIENT ITEM (${createdAt})
Score: 4 of 3
Inspector Notes: a lot of rust around pipe
Plan to fix: replace pipe completely
Section: Title
Subtitle: Sub Title

${process.env.CLIENT_DOMAIN}/properties/${PROPERTY_ID}/deficient-items/${DEFICIENT_ITEM_ID}`;
    let actual = '';

    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`,
        body => {
          actual = body.desc;
          return body;
        }
      )
      .reply(200, trelloCardPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);
    await db.ref(TRELLO_ORG_INTEGRATION_DB_PATH).set(TRELLO_INTEGRATION_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    const result = await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    const propertyTrelloCardsSnap = await db
      .ref(TRELLO_CARDS_DB_PATH)
      .once('value');

    const propertyTrelloCards = propertyTrelloCardsSnap.val();
    expect(propertyTrelloCards).to.not.equal(null, 'created Trello cards');

    // Assertions
    Object.keys(propertyTrelloCards).forEach(trelloCardId => {
      expect(propertyTrelloCards[trelloCardId]).to.equal(DEFICIENT_ITEM_ID);
    });

    expect(result.body.message).to.equal('successfully created trello card');
    expect(actual).to.equal(expected, 'compiled correct card description');
  });

  it('should set the authorized trello member as the creator of the card', async () => {
    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`,
        body => {
          const { idMembers: actual } = body;
          expect(actual).to.have.string(TRELLO_MEMBER_ID);
          return body;
        }
      )
      .reply(200, trelloCardPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);
    await db.ref(TRELLO_ORG_INTEGRATION_DB_PATH).set(TRELLO_INTEGRATION_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);
  });

  it('should not escape the description of the card', async () => {
    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`,
        body => {
          const { desc: result } = body;
          const actual = result.search(/&[#a-z0-9]+;/g);
          expect(actual).to.equal(-1);
          return body;
        }
      )
      .reply(200, trelloCardPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(
      Object.assign({}, DEFICIENT_ITEM_DATA, {
        currentPlanToFix: `I'll test`,
        itemInspectorNotes: `<i>I</i>`,
      })
    );
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);
    await db.ref(TRELLO_ORG_INTEGRATION_DB_PATH).set(TRELLO_INTEGRATION_DATA);

    // Execute & Get Result
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);
  });

  it("should add the trello card's short URL to its' associated deficient item", async () => {
    const expected = 'trello.com/c/short-url';

    // Stub Requests
    nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`
      )
      .reply(200, Object.assign({}, trelloCardPayload, { shortUrl: expected }));

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);
    await db.ref(TRELLO_ORG_INTEGRATION_DB_PATH).set(TRELLO_INTEGRATION_DATA);

    // Execute
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // Test Result
    const result = await db
      .ref(`${DEFICIENT_ITEM_DB_PATH}/trelloCardURL`)
      .once('value');
    const actual = result.val();

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should apply any deficient item due date to the Trello card using the property's zip as a UTC offest", async () => {
    const expected = moment(NOW)
      .tz('America/Indiana/Indianapolis') // TZ for property
      .toISOString(true)
      .slice(-6);

    // Stub Requests
    const createCardReq = nock('https://api.trello.com')
      .post(
        `/1/cards?idList=${TRELLO_LIST_ID}&keyFromSource=all&key=${TRELLO_API_KEY}&token=${TRELLO_AUTH_TOKEN}`,
        body => {
          const { due: result } = body;
          const actual = result.slice(-6);
          expect(actual).to.equal(expected);
          return body;
        }
      )
      .reply(200, trelloCardPayload);

    // setup database
    await db.ref(`/users/${USER_ID}`).set(USER); // add admin user
    await db.ref(`/properties/${PROPERTY_ID}`).set(PROPERTY_DATA);
    await db.ref(TRELLO_CREDENTIAL_DB_PATH).set(TRELLO_SYSTEM_INTEGRATION_DATA);
    await db.ref(DEFICIENT_ITEM_DB_PATH).set(DEFICIENT_ITEM_DATA);
    await db
      .ref(`/inspections/${INSPECTION_ID}/template/items/${ITEM_ID}`)
      .set(INSPECTION_ITEM_DATA);
    await db.ref(TRELLO_INTEGRATIONS_DB_PATH).set(INTEGRATIONS_DATA);
    await db.ref(TRELLO_ORG_INTEGRATION_DB_PATH).set(TRELLO_INTEGRATION_DATA);

    // Execute
    const app = createTrelloDeficientItemCardHandler(
      db,
      stubFirbaseAuth(USER_ID),
      CLIENT_APP_URI_TEMPL
    );
    await request(app)
      .post(API_PATH)
      .send()
      .set('Accept', 'application/json')
      .set('Authorization', 'fb-jwt stubbed-by-auth')
      .expect('Content-Type', /json/)
      .expect(201);

    // Assertions
    const actual = createCardReq.isDone();
    expect(actual).to.equal(true, 'resolved Trello request');
  });
});
