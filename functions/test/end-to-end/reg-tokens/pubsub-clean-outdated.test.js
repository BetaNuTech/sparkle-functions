const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const tokensModel = require('../../../models/registration-tokens');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('../../setup');

const ONE_MONTHS_SEC = 2629805;
const SIX_MONTHS_SEC = 15778800;
const TWENTY_SEVEN_DAYS_SEC = 2332800;

describe('Reg Token | Pubsub | Sync Outdated', () => {
  afterEach(() => cleanDb(db));

  it('should remove registration tokens older than 1 month', async () => {
    const nowUnix = Math.round(Date.now() / 1000);
    const userId = uuid();
    const deletedTokenId = uuid();
    const deletedTokenId2 = uuid();
    const unchangedTokenId = uuid();

    // Setup database
    await tokensModel.createRecord(db, userId, {
      [deletedTokenId]: nowUnix - ONE_MONTHS_SEC,
      [deletedTokenId2]: nowUnix - SIX_MONTHS_SEC,
      [unchangedTokenId]: nowUnix - TWENTY_SEVEN_DAYS_SEC,
    });

    // Execute
    await test.wrap(cloudFunctions.regTokensSync)();

    // Results
    const resultSnap = await tokensModel.findRecord(db, userId);
    const results = resultSnap.data();

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
