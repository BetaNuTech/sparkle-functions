const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const {
  createFirestore,
  createCollection,
  createSnapshot,
  createPubSub,
} = require('../../../test-helpers/stubs');
const usersModel = require('../../../models/users');
const propertiesModel = require('../../../models/properties');
const integrationsModel = require('../../../models/integrations');
const notificationsModel = require('../../../models/notifications');
const createHandler = require('../../../notifications/on-create-v2');

describe('Notifications | On Create V2', function() {
  afterEach(() => sinon.restore());

  it("uses a property's configured Slack channel when configured", async () => {
    const expected = 'property-slack-channel';
    const propertyId = uuid();
    const notificationId = uuid();
    const property = mocking.createProperty({
      slackChannel: expected,
    });
    const notificiation = mocking.createNotification({ property: propertyId });

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(
        createSnapshot('slack', { defaultChannelName: 'default-channel' })
      );
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();

    let actual = '';

    // Capture published channel
    const publisher = buff => {
      actual = buff.toString('utf-8');
    };

    await createHandler(
      createFirestore(),
      createPubSub(publisher),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('it sets empty slack notification title for property notifications', async () => {
    const expected = '';
    const propertyId = uuid();
    const notificationId = uuid();
    const property = mocking.createProperty({
      slackChannel: 'property-slack-channel',
    });
    const notificiation = mocking.createNotification({ property: propertyId });

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(
        createSnapshot('slack', { defaultChannelName: 'default-channel' })
      );
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());
    let actual = '*';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update.slack.title;
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('uses organization (default) Slack channel when property has no Slack channel', async () => {
    const expected = 'organization-channel';
    const propertyId = uuid();
    const notificationId = uuid();
    const property = mocking.createProperty({
      slackChannel: '',
    });
    const notificiation = mocking.createNotification({ property: propertyId });

    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));
    sinon.stub(integrationsModel, 'firestoreFindSlack').resolves(
      createSnapshot('slack', { defaultChannelName: `#${expected}` }) // test "#" removal
    );
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();

    let actual = '';

    // Capture published channel
    const publisher = buff => {
      actual = buff.toString('utf-8');
    };

    await createHandler(
      createFirestore(),
      createPubSub(publisher),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('marks notification as published to Slack when there is no Slack integration configured', async () => {
    const expected = true;
    const notificationId = uuid();
    const notificiation = mocking.createNotification();

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', null));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = false;
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update['publishedMediums.slack'];
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('marks notification as published to Slack when there is no discoverable channel', async () => {
    const expected = true;
    const notificationId = uuid();
    const notificiation = mocking.createNotification();
    const slackOrg = { defaultChannelName: '' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = false;
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update['publishedMediums.slack'];
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('creates a slack message from a notification summary when no markdown body provided', async () => {
    const expected = 'expected-summary';
    const notificationId = uuid();
    const notificiation = mocking.createNotification({ summary: expected });
    const slackOrg = { defaultChannelName: 'org-channel' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it("creates a slack message from the notification's markdown body when provided", async () => {
    const expected = '**expected-markdown-body**';
    const notificationId = uuid();
    const notificiation = mocking.createNotification({
      markdownBody: expected,
    });
    const slackOrg = { defaultChannelName: 'org-channel' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('adds any provided notification user agent to the slack message', async () => {
    const expected = 'iOS';
    const notificationId = uuid();
    const notificiation = mocking.createNotification({
      userAgent: expected,
    });
    const slackOrg = { defaultChannelName: 'org-channel' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.contain(expected);
  });

  it('only creates push notifications for admins for admin notifications', async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const notificationId = uuid();
    const notificiation = mocking.createNotification();
    const integrationConfig = mocking.createSlackIntegration({
      defaultChannelName: '',
    });

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', integrationConfig));

    const tests = [
      {
        data: { firstName: 'no permission' },
        expected: false,
        msg: 'unpermissioned user has no admin push notification',
      },
      {
        data: {
          firstName: 'property level',
          properties: { [propertyId]: true },
        },
        expected: false,
        msg: 'property user has no admin push notification',
      },
      {
        data: {
          firstName: 'team lead',
          teams: { [teamId]: { [propertyId]: true } },
        },
        expected: false,
        msg: 'team lead user has no admin push notification',
      },
      {
        data: { firstName: 'corporate', corporate: true },
        expected: false,
        msg: 'corporate user has no admin push notification',
      },
      {
        data: { firstName: 'admin', admin: true },
        expected: true,
        msg: 'admin user has admin push notification',
      },
    ];

    const queryUsers = sinon.stub(usersModel, 'firestoreFindAll');
    const updateNotification = sinon.stub(
      notificationsModel,
      'firestoreUpdateRecord'
    );

    for (let i = 0; i < tests.length; i++) {
      let actual;
      const { data, expected, msg } = tests[i];
      queryUsers.resolves(createCollection(createSnapshot(userId, data)));
      updateNotification.callsFake((fs, id, update) => {
        actual = Boolean((update.push || {})[userId]);
        return Promise.resolve();
      });
      await createHandler(
        createFirestore(),
        createPubSub(),
        'slack-topic',
        'push-topic'
      )(createSnapshot(notificationId, notificiation), {
        params: { notificationId },
      });
      expect(actual).to.equal(expected, msg);
    }
  });

  it('creates push notifications for permissioned users for property notifications', async () => {
    const userId = uuid();
    const teamId = uuid();
    const propertyId = uuid();
    const notificationId = uuid();
    const notificiation = mocking.createNotification({ property: propertyId });
    const property = mocking.createProperty({ slackChannel: '' });
    const integrationConfig = mocking.createSlackIntegration({
      defaultChannelName: '',
    });

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', integrationConfig));
    sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(createSnapshot(propertyId, property));

    const tests = [
      {
        data: { firstName: 'no permission' },
        expected: false,
        msg: 'unpermissioned user has no property push notification',
      },
      {
        data: {
          firstName: 'associated property level',
          properties: { [propertyId]: true },
        },
        expected: true,
        msg: 'property user has property push notification',
      },
      {
        data: {
          firstName: 'unassociated property level',
          properties: { [uuid()]: true },
        },
        expected: false,
        msg: 'unassociated property user has no property push notification',
      },
      {
        data: {
          firstName: 'associated team lead',
          teams: { [teamId]: { [propertyId]: true } },
        },
        expected: true,
        msg: 'team lead has property push notification',
      },
      {
        data: {
          firstName: 'unassociated team lead',
          teams: { [teamId]: { [uuid()]: true } },
        },
        expected: false,
        msg: 'unassociated team lead has no property push notification',
      },
      {
        data: { firstName: 'corporate', corporate: true },
        expected: true,
        msg: 'corporate user has property push notification',
      },
      {
        data: { firstName: 'admin', admin: true },
        expected: true,
        msg: 'admin user has property push notification',
      },
    ];

    const queryUsers = sinon.stub(usersModel, 'firestoreFindAll');
    const updateNotification = sinon.stub(
      notificationsModel,
      'firestoreUpdateRecord'
    );

    for (let i = 0; i < tests.length; i++) {
      let actual;
      const { data, expected, msg } = tests[i];
      queryUsers.resolves(createCollection(createSnapshot(userId, data)));
      updateNotification.callsFake((fs, id, update) => {
        actual = Boolean((update.push || {})[userId]);
        return Promise.resolve();
      });
      await createHandler(
        createFirestore(),
        createPubSub(),
        'slack-topic',
        'push-topic'
      )(createSnapshot(notificationId, notificiation), {
        params: { notificationId },
      });
      expect(actual).to.equal(expected, msg);
    }
  });

  it('does not create a push notifications for the creator of the notification', async () => {
    const userId = uuid();
    const creatorId = uuid();
    const expected = uuid();
    const notificiation = mocking.createNotification({ creator: creatorId });
    const integrationConfig = mocking.createSlackIntegration({
      defaultChannelName: '',
    });

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', integrationConfig));
    sinon
      .stub(usersModel, 'firestoreFindAll')
      .resolves(
        createCollection(
          createSnapshot(userId, { firstName: 'recipient', admin: true })
        )
      );
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();

    let actual = '';

    // Capture published message
    const publisher = buff => {
      actual = buff.toString('utf-8');
    };

    await createHandler(
      createFirestore(),
      createPubSub(publisher),
      'slack-topic',
      'push-topic'
    )(createSnapshot(expected, notificiation), {
      params: { notificationId: expected },
    });
    expect(actual).to.equal(expected);
  });

  it('publishs a push notifications event for the notification with push notifications added', async () => {
    const expected = uuid();
    const creatorId = uuid();
    const notificationId = uuid();
    const notificiation = mocking.createNotification({ creator: creatorId });
    const integrationConfig = mocking.createSlackIntegration({
      defaultChannelName: '',
    });

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', integrationConfig));
    sinon
      .stub(usersModel, 'firestoreFindAll')
      .resolves(
        createCollection(
          createSnapshot(expected, { firstName: 'recipient', admin: true }),
          createSnapshot(creatorId, { firstName: 'creator', admin: true })
        )
      );

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((fs, id, update) => {
        actual = Object.keys(update.push || {}).join(',');
        return Promise.resolve();
      });

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });
    expect(actual).to.equal(expected);
  });

  it('creates a slack message from a notification summary when no markdown body provided', async () => {
    const expected = 'expected-summary';
    const notificationId = uuid();
    const notificiation = mocking.createNotification({ summary: expected });
    const slackOrg = { defaultChannelName: 'org-channel' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it("creates a slack message from the notification's markdown body when provided", async () => {
    const expected = '**expected-markdown-body**';
    const notificationId = uuid();
    const notificiation = mocking.createNotification({
      markdownBody: expected,
    });
    const slackOrg = { defaultChannelName: 'org-channel' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      })
      .onSecondCall()
      .resolves();

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });

  it('marks notification without any recipients as already published to push', async () => {
    const expected = true;
    const notificationId = uuid();
    const notificiation = mocking.createNotification();
    const slackOrg = { defaultChannelName: '' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));
    sinon.stub(usersModel, 'firestoreFindAll').resolves(createCollection());

    let actual = false;
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .callsFake((_, id, update) => {
        actual = update['publishedMediums.push'];
        return Promise.resolve();
      });

    await createHandler(
      createFirestore(),
      createPubSub(),
      'slack-topic',
      'push-topic'
    )(createSnapshot(notificationId, notificiation), {
      params: { notificationId },
    });

    expect(actual).to.equal(expected);
  });
});
