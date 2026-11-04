const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const tokensModel = require('../../../models/registration-tokens');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('../../setup');

/**
 * Minimal Realtime Database DataSnapshot
 * @param  {any} value
 * @return {Object}
 */
function snapshot(value) {
  return { exists: () => value !== null, val: () => value };
}

/**
 * Run the mirror for a Realtime
 * Database write of a user's tokens
 * @param  {String} userId
 * @param  {Object?} before
 * @param  {Object} after
 * @return {Promise}
 */
function writeRealtimeTokens(userId, before, after) {
  const change = test.makeChange(snapshot(before), snapshot(after));
  return test.wrap(cloudFunctions.regTokensRealtimeMirror)(change, {
    params: { userId },
  });
}

describe('Reg Token | Watchers | Realtime Mirror', () => {
  afterEach(() => cleanDb(db));

  it('copies a token iOS writes to the Realtime Database into Firestore', async () => {
    const userId = uuid();
    const token = `${uuid()}:APA91b-${uuid()}`;
    const iosTimestamp = 1730736000.4567; // Date().timeIntervalSince1970

    await writeRealtimeTokens(userId, null, { [token]: iosTimestamp });

    const resultSnap = await tokensModel.findRecord(db, userId);
    expect(resultSnap.data()).to.deep.equal({ [token]: 1730736000 });
  });

  it('keeps existing Firestore tokens and adds refreshed ones', async () => {
    const userId = uuid();
    const existing = `${uuid()}:existing`;
    const refreshed = `${uuid()}:refreshed`;
    await tokensModel.createRecord(db, userId, { [existing]: 100 });

    await writeRealtimeTokens(
      userId,
      { [refreshed]: 200 },
      { [refreshed]: 300 }
    );

    const resultSnap = await tokensModel.findRecord(db, userId);
    expect(resultSnap.data()).to.deep.equal({
      [existing]: 100,
      [refreshed]: 300,
    });
  });

  it('does not restore an unchanged token removed from Firestore', async () => {
    const userId = uuid();
    const removed = `${uuid()}:removed`;
    const added = `${uuid()}:added`;
    await tokensModel.createRecord(db, userId, {});

    await writeRealtimeTokens(
      userId,
      { [removed]: 200 },
      { [removed]: 200, [added]: 300 }
    );

    const resultSnap = await tokensModel.findRecord(db, userId);
    expect(resultSnap.data()).to.deep.equal({ [added]: 300 });
  });
});
