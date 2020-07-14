const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
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
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();

    let actual = '';

    // Capture published channel
    const publisher = buff => {
      actual = buff.toString('utf-8');
    };

    await createHandler(stubFirestore(), stubPubSub(publisher), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

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
    let actual = '*';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((_, id, update) => {
        actual = update.slack.title;
        return Promise.resolve();
      });

    await createHandler(stubFirestore(), stubPubSub(), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

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
    sinon.stub(notificationsModel, 'firestoreUpdateRecord').resolves();

    let actual = '';

    // Capture published channel
    const publisher = buff => {
      actual = buff.toString('utf-8');
    };

    await createHandler(stubFirestore(), stubPubSub(publisher), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

    expect(actual).to.equal(expected);
  });

  it('marks notification as published to Slack when there is no discoverable channel', async () => {
    const expected = true;
    const notificationId = uuid();
    const notificiation = mocking.createNotification({ summary: expected });
    const slackOrg = { defaultChannelName: '' };

    sinon
      .stub(integrationsModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', slackOrg));

    let actual = false;
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((_, id, update) => {
        actual = update['publishedMediums.slack'];
        return Promise.resolve();
      });

    await createHandler(stubFirestore(), stubPubSub(), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

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

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      });

    await createHandler(stubFirestore(), stubPubSub(), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

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

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      });

    await createHandler(stubFirestore(), stubPubSub(), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

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

    let actual = '';
    sinon
      .stub(notificationsModel, 'firestoreUpdateRecord')
      .callsFake((_, id, update) => {
        actual = update.slack.message;
        return Promise.resolve();
      });

    await createHandler(stubFirestore(), stubPubSub(), 'topic')(
      createSnapshot(notificationId, notificiation),
      { params: { notificationId } }
    );

    expect(actual).to.contain(expected);
  });
});

function stubFirestore() {
  return {
    collection: () => {},
    batch: () => ({}),
  };
}

function stubPubSub(cb = () => {}) {
  return {
    topic: () => ({
      publisher: () => ({
        publish: (...args) => {
          cb(...args);
          return Promise.resolve();
        },
      }),
    }),
  };
}

function createSnapshot(id = uuid(), data = null) {
  return {
    exists: Boolean(data),
    id,
    data: () => data,
  };
}
