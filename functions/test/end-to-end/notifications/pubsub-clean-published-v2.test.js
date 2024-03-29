const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const notificationsModel = require('../../../models/notifications');
const { db, test, cloudFunctions } = require('../../setup');

describe('Notifications | Pubsub | Clean Published V2', () => {
  afterEach(() => cleanDb(db));

  it('should remove all notifications that have been published to all mediums', async () => {
    const notification1Id = uuid();
    const notification2Id = uuid();
    const notification3Id = uuid();
    const notification1 = mocking.createNotification();
    const notification2 = mocking.createNotification();
    const notification3 = mocking.createNotification();
    notification1.publishedMediums.slack = true;
    notification1.publishedMediums.push = true;
    notification2.publishedMediums.slack = true;
    notification2.publishedMediums.push = true;
    notification3.publishedMediums.push = true; // only published to push

    // Setup database
    await notificationsModel.createRecord(db, notification1Id, notification1);
    await notificationsModel.createRecord(db, notification2Id, notification2);
    await notificationsModel.createRecord(db, notification3Id, notification3);

    // Execute
    await test.wrap(cloudFunctions.cleanupNotificationsV2)();

    // Test results
    const note1Snap = await notificationsModel.findRecord(db, notification1Id);
    const note2Snap = await notificationsModel.findRecord(db, notification2Id);
    const note3Snap = await notificationsModel.findRecord(db, notification3Id);

    // Assertions
    [
      {
        actual: note1Snap.exists,
        expected: false,
        msg: 'removed published notification 1',
      },
      {
        actual: note2Snap.exists,
        expected: false,
        msg: 'removed published notification 2',
      },
      {
        actual: note3Snap.exists,
        expected: true,
        msg: 'kept unpublished notification 3',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
