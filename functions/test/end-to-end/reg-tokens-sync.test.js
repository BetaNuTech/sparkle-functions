const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Registration Token Sync', () => {
  afterEach(() => cleanDb(db));

  it('should replace boolean device tokens values with timestamps', async () => {
    const nowUnix = Date.now() / 1000;
    const userId = uuid();
    const unchangedTokenId = uuid();

    // Setup database
    await db.ref('/registrationTokens').set({
      [userId]: {
        [uuid()]: true,
        [unchangedTokenId]: nowUnix
      },
      [uuid()]: {
        [uuid()]: true
      },
    });

    // Execute
    await test.wrap(cloudFunctions.regTokensSync)();

    // Test results
    const resultsSnap = await db.ref('/registrationTokens').once('value');
    const results = resultsSnap.val();

    // Assertions
    Object.keys(results).forEach(userId => {
      Object.keys(results[userId]).forEach(tokenId => {
        const actual = results[userId][tokenId];
        expect(actual).to.be.a('number', 'token value a number');
        expect(actual).to.be.at.least(nowUnix, 'token value accurate timestamp value');
      });
    });

    const actualUnchangedToken = results[userId][unchangedTokenId];
    expect(actualUnchangedToken).to.equal(actualUnchangedToken, 'existing timestamp unchanged');
  });
});
