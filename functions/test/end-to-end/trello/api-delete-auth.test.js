const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const handler = require('../../../trello/api/delete-auth');
const uuid = require('../../../test-helpers/uuid');
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
    await systemModel.firestoreUpsertTrello(fs, trelloCredentials);

    // Execute
    const app = createApp();
    await request(app)
      .delete('/t')
      .send()
      .expect(204);

    // Get Results
    const systemDoc = await systemModel.firestoreFindTrello(fs);
    const actual = systemDoc.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('removes all property integration details', async () => {
    const expected = 0;
    const trelloCredentials = {
      authToken: 'xoxp-auth-token',
      apikey: 'key',
      user: uuid(),
    };
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
    await systemModel.firestoreUpsertTrello(fs, trelloCredentials);
    await integrationsModel.firestoreCreateTrelloProperty(
      fs,
      uuid(),
      propertyTrelloIntegration
    );
    await integrationsModel.firestoreCreateTrelloProperty(
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
    const propertyTrelloIntegrations = await integrationsModel.firestoreFindAllTrelloProperties(
      fs
    );
    const actual = propertyTrelloIntegrations.length;

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
