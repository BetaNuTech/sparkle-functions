const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const {
  createFirestore,
  createCollection,
  createSnapshot,
  createPubSubHandler,
} = require('../../../test-helpers/stubs');
const systemModel = require('../../../models/system');
const notificationsModel = require('../../../models/notifications');
const integrationsModel = require('../../../models/integrations');
const slack = require('../../../services/slack');
const createHandler = require('../../../notifications/pubsub/publish-slack-v2');

describe('Notifications | Pubsub | Publish Slack V2', function() {
  afterEach(() => sinon.restore());

  it('looks up all Slack notifications belonging to requested channel', async () => {
    const expected = 'slack-channel';
    const credentials = mocking.createSlackCredentials();
    const message = Buffer.from(expected).toString('base64');

    sinon
      .stub(systemModel, 'findSlack')
      .resolves(createSnapshot('slack', credentials));

    let actual = '';
    sinon.stub(notificationsModel, 'query').callsFake((_, query) => {
      actual = (query['slack.channel'] && query['slack.channel'][1]) || '';
      return Promise.resolve(createCollection()); // empty
    });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      'topic'
    );

    expect(actual).to.equal(expected);
  });

  it('looks up all Slack notifications by default', async () => {
    const expected = 0;
    const credentials = mocking.createSlackCredentials();

    sinon
      .stub(systemModel, 'findSlack')
      .resolves(createSnapshot('slack', credentials));

    let actual = '';
    sinon.stub(notificationsModel, 'query').callsFake((_, query) => {
      actual = query['slack.createdAt'] ? query['slack.createdAt'][1] : NaN;
      return Promise.resolve(createCollection()); // empty
    });

    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    expect(actual).to.equal(expected);
  });
  it('marks each notification as published immediately instead of in the shared batch', async () => {
    const credentials = mocking.createSlackCredentials();
    const notification = createSlackNotification('notif-1', 'channel');
    stubPublishing(credentials, [notification]);
    const update = sinon.stub(notificationsModel, 'updateRecord').resolves();

    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    expect(update.callCount).to.equal(1);
    const [, notificationId, data, batch] = update.firstCall.args;
    expect(notificationId).to.equal('notif-1');
    expect(data).to.deep.equal({ 'publishedMediums.slack': true });
    expect(batch).to.equal(undefined, 'update is not deferred to the batch');
  });

  it('still commits and marks remaining notifications when one was deleted before publishing completed', async () => {
    const credentials = mocking.createSlackCredentials();
    const deleted = createSlackNotification('deleted-1', 'channel');
    const remaining = createSlackNotification('remaining-1', 'channel');
    stubPublishing(credentials, [deleted, remaining]);

    // Firestore lookalike where "deleted-1" no longer
    // exists: direct updates reject right away while
    // batched updates reject when the batch is committed
    const existing = ['remaining-1'];
    const updated = [];
    const createNotFound = id => {
      const err = Error(`5 NOT_FOUND: No document to update: ${id}`);
      err.code = 5;
      return err;
    };
    const batched = [];
    const commit = sinon.stub().callsFake(() => {
      const missing = batched.find(id => !existing.includes(id));
      return missing
        ? Promise.reject(createNotFound(missing))
        : Promise.resolve();
    });
    const db = createFirestore({
      collection: () => ({
        doc: id => ({
          id,
          update: () => {
            if (!existing.includes(id)) {
              return Promise.reject(createNotFound(id));
            }
            updated.push(id);
            return Promise.resolve();
          },
        }),
      }),
      batch: () => ({
        commit,
        update: ref => batched.push(ref.id),
      }),
    });

    let actual = null;
    try {
      await createHandler(db, createPubSubHandler(), 'topic');
    } catch (err) {
      actual = err;
    }

    expect(actual).to.equal(null, 'handler resolves despite missing record');
    expect(updated).to.deep.equal(
      ['remaining-1'],
      'remaining notification marked as published'
    );
    expect(commit.callCount).to.equal(1, 'batch committed once');
  });
});

/**
 * Stub the credentials, notification lookup
 * and Slack API so publishing succeeds
 * @param  {Object} credentials
 * @param  {Object[]} notifications - snapshots
 */
function stubPublishing(credentials, notifications) {
  sinon
    .stub(systemModel, 'findSlack')
    .resolves(createSnapshot('slack', credentials));
  sinon
    .stub(notificationsModel, 'query')
    .resolves(createCollection(...notifications));
  sinon.stub(slack, 'joinChannel').resolves({ already_in_channel: true });
  sinon.stub(slack, 'sendSlackChannelMessage').resolves({});
  sinon.stub(integrationsModel, 'updateSlack').resolves();
}

/**
 * Create a notification snapshot
 * with a Slack medium payload
 * @param  {String} id
 * @param  {String} channel
 * @return {Object} - snapshot
 */
function createSlackNotification(id, channel) {
  return createSnapshot(id, {
    title: 'title',
    summary: 'summary',
    slack: {
      channel,
      title: 'title',
      message: 'message',
      createdAt: Math.round(Date.now() / 1000),
    },
  });
}
