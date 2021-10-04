const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const handler = require('../../../trello/api/delete-auth');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const { fs } = require('../../setup');

describe('Trello | API | DELETE Auth', () => {
  afterEach(() => cleanDb(null, fs));

  it('successfully deletes Trello system credentials', async () => {
    const expected = false;
    const trelloCredentials = {
      authToken: 'xoxp-auth-token',
      apikey: 'key',
      user: uuid(),
    };

    // Setup Database
    await systemModel.upsertTrello(fs, trelloCredentials);

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const systemDoc = await systemModel.findTrello(fs);
    const actual = systemDoc.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('successfully deletes Trello system property records', async () => {
    const expected = false;
    const propertyId = uuid();
    const trelloProperty = { cards: { [uuid()]: mocking.nowUnix() } };
    const trelloCredentials = {
      authToken: 'token',
      apikey: 'key',
      user: uuid(),
    };

    // Setup Database
    await systemModel.upsertTrello(fs, trelloCredentials);
    await systemModel.createTrelloProperty(fs, propertyId, trelloProperty);

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const systemDoc = await systemModel.findTrelloProperty(fs, propertyId);
    const actual = systemDoc.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('removes all property integration details', async () => {
    const expected = 0;
    const propertyTrelloIntegration = {
      grantedBy: uuid(),
      updatedAt: Math.round(Date.now() / 1000),
      openBoard: uuid(),
      openBoardName: 'Open board',
      openList: uuid(),
      openListName: 'Open List',
      closedBoard: uuid(),
      closedBoardName: 'Closed Board',
      closedList: uuid(),
      closedListName: 'Closed List',
    };

    // Setup Database
    await integrationsModel.createTrelloProperty(
      fs,
      uuid(),
      propertyTrelloIntegration
    );
    await integrationsModel.createTrelloProperty(
      fs,
      uuid(),
      propertyTrelloIntegration
    );

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const propertyTrelloIntegrations = await integrationsModel.findAllTrelloProperties(
      fs
    );
    const actual = propertyTrelloIntegrations.length;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('removes integration organization', async () => {
    const expected = false;
    const trelloOrg = {
      member: '123',
      trelloUsername: 'user',
      trelloEmail: 'email',
      trelloFullName: 'test user',
    };

    // Setup Database
    await integrationsModel.createTrello(fs, trelloOrg);

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const orgDoc = await integrationsModel.findTrello(fs);
    const actual = orgDoc.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.delete('/t', stubAuth, handler(fs));
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
