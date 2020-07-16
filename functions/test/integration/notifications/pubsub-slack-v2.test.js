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
const createHandler = require('../../../notifications/pubsub/publish-slack-v2');

describe('Notifications | Pubsub | Publish Slack V2', function() {
  afterEach(() => sinon.restore());

  it('looks up all Slack notifications belonging to requested channel', async () => {
    const expected = 'slack-channel';
    const credentials = mocking.createSlackCredentials();
    const message = Buffer.from(expected).toString('base64');

    sinon
      .stub(systemModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', credentials));

    let actual = '';
    sinon.stub(notificationsModel, 'firestoreQuery').callsFake((_, query) => {
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
      .stub(systemModel, 'firestoreFindSlack')
      .resolves(createSnapshot('slack', credentials));

    let actual = '';
    sinon.stub(notificationsModel, 'firestoreQuery').callsFake((_, query) => {
      actual = query['slack.createdAt'] ? query['slack.createdAt'][1] : NaN;
      return Promise.resolve(createCollection()); // empty
    });

    await createHandler(createFirestore(), createPubSubHandler(), 'topic');

    expect(actual).to.equal(expected);
  });
});
