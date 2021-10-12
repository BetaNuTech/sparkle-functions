const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const stubs = require('../../../test-helpers/stubs');
const notificationsModel = require('../../../models/notifications');
const createHandler = require('../../../notifications/pubsub/clean-published-v2');

const { createFirestore, createPubSubHandler } = stubs;

describe('Notifications | Pubsub | Clean Published V2', function() {
  afterEach(() => sinon.restore());

  it('paginates notification deletes into batches', async () => {
    const expected = 2;
    const notifications = Array(10).fill(
      mocking.createNotification({
        publishedMediums: { slack: true, push: true },
      })
    );

    sinon
      .stub(notificationsModel, 'query')
      .resolves(stubs.wrapSnapshot(notifications));

    sinon.stub(notificationsModel, 'destroyRecord').resolves();
    const fs = createFirestore();
    const commit = { commit: () => Promise.resolve() };
    const commitStub = sinon.spy(commit, 'commit');
    sinon.stub(fs, 'batch').returns(commit);

    await createHandler(
      fs,
      createPubSubHandler(),
      'topic',
      5 // 5 notifications per batch
    );

    const actual = commitStub.callCount;
    expect(actual).to.equal(expected);
  });
});
