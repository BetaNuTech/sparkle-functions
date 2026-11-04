const { expect } = require('chai');
const publishPushMessage = require('./publish-push-message');

const { createMessage, createPushResult } = publishPushMessage;

/**
 * @param  {String} code
 * @param  {String?} message
 * @return {Error}
 */
function fcmError(code, message = code) {
  const err = Error(message);
  err.code = code;
  return err;
}

describe('Notifications | Utils | Publish Push Message', () => {
  it('creates an FCM v1 message with an APNs alert block', () => {
    const actual = createMessage('token', 'title', 'body', {
      notificationId: 'note-1',
      propertyId: '',
      count: 2,
    });

    expect(actual.token).to.equal('token');
    expect(actual.notification).to.deep.equal({ title: 'title', body: 'body' });
    expect(actual.apns.headers).to.deep.equal({
      'apns-priority': '10',
      'apns-push-type': 'alert',
    });
    expect(actual.apns.payload.aps).to.deep.equal({ sound: 'default' });
    expect(actual.data).to.deep.equal({ notificationId: 'note-1', count: '2' });
  });

  it('sorts token failures into invalid tokens and other errors', () => {
    const tokens = [
      'ok',
      'unregistered',
      'invalid',
      'malformed',
      'payload',
      'down',
    ];
    const actual = createPushResult(tokens, [
      { success: true, messageId: 'm1' },
      {
        success: false,
        error: fcmError('messaging/registration-token-not-registered'),
      },
      {
        success: false,
        error: fcmError('messaging/invalid-registration-token'),
      },
      {
        success: false,
        error: fcmError(
          'messaging/invalid-argument',
          'The registration token is not a valid FCM registration token'
        ),
      },
      {
        success: false,
        error: fcmError('messaging/invalid-argument', 'Invalid JSON payload'),
      },
      { success: false, error: fcmError('messaging/server-unavailable') },
    ]);

    expect(actual.successCount).to.equal(1);
    expect(actual.failureCount).to.equal(5);
    expect(actual.messageIds).to.deep.equal(['m1']);
    expect(actual.invalidTokens).to.deep.equal([
      'unregistered',
      'invalid',
      'malformed',
    ]);
    expect(actual.errors.map(e => e.code)).to.deep.equal([
      'messaging/invalid-argument',
      'messaging/server-unavailable',
    ]);
  });
});
