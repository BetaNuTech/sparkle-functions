const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const integrationsModel = require('../../../models/integrations');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Notifications | On Create V2', () => {
  afterEach(() => cleanDb(null, fs));

  it('should configure notification for an admin slack channel message', async () => {
    const creator = uuid();
    const result = {
      title: 'slack title',
      message: 'slack message',
      channel: 'admin-channel',
    };
    const notificationId = uuid();
    const slackIntegration = mocking.createSlackIntegration({
      defaultChannelName: result.channel,
    });
    const expected = mocking.createNotification(
      {
        title: result.title,
        summary: result.message,
        property: '',
        creator,
      },
      result
    );
    const notification = mocking.createNotification({
      title: result.title,
      summary: result.message,
      property: '',
      creator,
    });

    // Setup database
    await integrationsModel.firestoreSetSlack(fs, slackIntegration);
    await notificationsModel.firestoreCreateRecord(
      fs,
      notificationId,
      notification
    );
    const notificationsSnap = await notificationsModel.firestoreFindRecord(
      fs,
      notificationId
    );

    // Execute
    const wrapped = test.wrap(cloudFunctions.createNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId },
    });

    // Assertions
    const snap = await notificationsModel.firestoreFindRecord(
      fs,
      notificationId
    );
    const actual = snap.data();

    expect(actual).to.deep.equal(expected);
  });

  it('should create a property slack notification when property channel is set', async () => {
    const creator = uuid();
    const result = {
      title: '', // property notifications have no title
      message: 'slack message',
      channel: 'property-channel',
    };
    const propertyId = uuid();
    const notificationId = uuid();
    const slackIntegration = mocking.createSlackIntegration({
      defaultChannelName: 'admin-channel',
    });
    const property = mocking.createProperty({ slackChannel: result.channel });
    const expected = mocking.createNotification(
      {
        summary: result.message,
        property: propertyId,
        creator,
      },
      result
    );
    const notification = mocking.createNotification({
      summary: result.message,
      property: propertyId,
      creator,
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, property);
    await integrationsModel.firestoreSetSlack(fs, slackIntegration);
    await notificationsModel.firestoreCreateRecord(
      fs,
      notificationId,
      notification
    );
    const notificationsSnap = await notificationsModel.firestoreFindRecord(
      fs,
      notificationId
    );

    // Execute
    const wrapped = test.wrap(cloudFunctions.createNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId },
    });

    // Assertions
    const snap = await notificationsModel.firestoreFindRecord(
      fs,
      notificationId
    );
    const actual = snap.data();

    expect(actual).to.deep.equal(expected);
  });

  it('should copy unescaped markdown body to slack message', async () => {
    /* eslint-disable */
    const expected = `\`\`\`
  Name: PROPERTY NAME
  Team: Team NAME
  Cobalt Property Code: 7
  Slack Channel: #test-channel
  Templates: MS - Product Inspection, Pre- Move Out (21-30 Days)
  \`\`\`
  Edited by: Test User (testor@gmail.com)`;
    /* eslint-enable */
    const notificationId = uuid();
    const slackIntegration = mocking.createSlackIntegration({
      defaultChannelName: 'admin-channel',
    });
    const notification = mocking.createNotification({
      markdownBody: expected,
    });

    // Setup database
    await integrationsModel.firestoreSetSlack(fs, slackIntegration);
    await notificationsModel.firestoreCreateRecord(
      fs,
      notificationId,
      notification
    );
    const notificationsSnap = await notificationsModel.firestoreFindRecord(
      fs,
      notificationId
    );

    // Execute
    const wrapped = test.wrap(cloudFunctions.createNotification);
    await wrapped(notificationsSnap, {
      params: { notificationId },
    });

    // Assertions
    const snap = await notificationsModel.firestoreFindRecord(
      fs,
      notificationId
    );
    const actual = ((snap.data() || {}).slack || {}).message || '';

    expect(actual).to.equal(expected);
  });
});
