const test = require('firebase-functions-test')({
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'test-sapphire-inspections-8a9e3.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3',
}, '../../../auth.json');
const cloudFunctions = require('../../index');

describe('Send Push Message', () => {
  it('should remove a message after sending to its\' recipients', (done) => {
    // TODO create mock /pushMessages w/ recipientId:
    // const messageSnap = test.firestore.makeDocumentSnapshot({ recipientId: '123' ... }, '/pushMessages/<id>');
    // TODO create mock /registrationToken for recipientId
    // const tokenSnap = test.firestore.makeDocumentSnapshot({ '123': { <id>: true } }, '/registrationToken/123');
    // const wrapped = test.wrap(cloudFunctions.sendPushMessage);
    // wrapped(messageSnap).then(() => {
      // TODO test reg token removed
    // });
    done();
  });
});
