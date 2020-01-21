const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

const ONE_MONTHS_SEC = 2629805;
const SIX_MONTHS_SEC = 15778800;
const TWENTY_SEVEN_DAYS_SEC = 2332800;

describe('Registration Token Sync', () => {
  afterEach(() => cleanDb(db));

  it('should replace boolean device tokens values with timestamps', async () => {
    const nowUnix = Math.round(Date.now() / 1000);
    const userId = uuid();
    const unchangedTokenId = uuid();

    // Setup database
    await db.ref('/registrationTokens').set({
      [userId]: {
        [uuid()]: true,
        [unchangedTokenId]: nowUnix,
      },
      [uuid()]: {
        [uuid()]: true,
      },
    });

    // Execute
    await test.wrap(cloudFunctions.regTokensSync)();

    // Test results
    const resultsSnap = await db.ref('/registrationTokens').once('value');
    const results = resultsSnap.val();

    // Assertions
    Object.keys(results).forEach(id => {
      Object.keys(results[id]).forEach(tokenId => {
        const actual = results[id][tokenId];
        expect(actual).to.be.a('number', 'token value a number');
        expect(actual).to.be.at.least(
          nowUnix,
          'token value accurate timestamp value'
        );
      });
    });

    const actualUnchangedToken = results[userId][unchangedTokenId];
    expect(actualUnchangedToken).to.equal(
      actualUnchangedToken,
      'existing timestamp unchanged'
    );
  });

  it('should remove registration tokens older than 1 month', async () => {
    const nowUnix = Math.round(Date.now() / 1000);
    const userId = uuid();
    const deletedTokenId = uuid();
    const deletedTokenId2 = uuid();
    const unchangedTokenId = uuid();

    // Setup database
    await db.ref('/registrationTokens').set({
      [userId]: {
        [deletedTokenId]: nowUnix - ONE_MONTHS_SEC,
        [deletedTokenId2]: nowUnix - SIX_MONTHS_SEC,
        [unchangedTokenId]: nowUnix - TWENTY_SEVEN_DAYS_SEC,
      },
    });

    // Execute
    await test.wrap(cloudFunctions.regTokensSync)();

    // Results
    const resultsSnap = await db
      .ref(`/registrationTokens/${userId}`)
      .once('value');
    const results = resultsSnap.val();

    // Assertions
    [
      {
        actual: Boolean(results[deletedTokenId]),
        expected: false,
        msg: 'removed one month old token',
      },
      {
        actual: Boolean(results[deletedTokenId2]),
        expected: false,
        msg: 'removed six month old token',
      },
      {
        actual: Boolean(results[unchangedTokenId]),
        expected: true,
        msg: 'keep twenty seven day old token',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
