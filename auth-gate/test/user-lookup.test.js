const { expect } = require('chai');
const { findUserByEmail } = require('../user-lookup');

// Minimal Firestore stand-in. Records the queries it received so the tests can
// assert the fast path is preferred and the scan only runs on a miss.
function fakeDb(docs) {
  const calls = { exact: 0, scan: 0 };

  const snapshot = matched => ({
    empty: matched.length === 0,
    docs: matched.map(record => ({
      id: record.id,
      data: () => ({ email: record.email, isDisabled: record.isDisabled }),
    })),
  });

  const db = {
    calls,
    collection() {
      return {
        where(field, op, value) {
          calls.exact += 1;
          const matched = docs.filter(d => d[field] === value);
          return { limit: () => ({ get: async () => snapshot(matched) }) };
        },
        select() {
          calls.scan += 1;
          return { limit: () => ({ get: async () => snapshot(docs) }) };
        },
      };
    },
  };

  return db;
}

describe('user-lookup', () => {
  const docs = [
    { id: 'lower', email: 'lower@bluecoreresidential.com', isDisabled: false },
    { id: 'mixed', email: 'Mixed.Case@bluecoreresidential.com' },
    { id: 'off', email: 'off@bluecoreresidential.com', isDisabled: true },
  ];

  it('finds a lowercase email on the indexed fast path, without scanning', async () => {
    const db = fakeDb(docs);
    const actual = await findUserByEmail(db, 'lower@bluecoreresidential.com');

    expect(actual).to.include({ id: 'lower' });
    expect(db.calls.exact).to.equal(1);
    expect(db.calls.scan).to.equal(0, 'should not fall through to the scan');
  });

  it('normalizes the incoming email before querying', async () => {
    const db = fakeDb(docs);
    const actual = await findUserByEmail(db, '  LOWER@BluecoreResidential.com ');
    expect(actual).to.include({ id: 'lower' });
  });

  it('falls back to a scan to find a mixed-case stored email', async () => {
    const db = fakeDb(docs);
    const actual = await findUserByEmail(db, 'mixed.case@bluecoreresidential.com');

    expect(actual).to.include({ id: 'mixed' });
    expect(db.calls.exact).to.equal(1);
    expect(db.calls.scan).to.equal(1);
  });

  it('returns null for an address belonging to nobody', async () => {
    const db = fakeDb(docs);
    expect(await findUserByEmail(db, 'stranger@gmail.com')).to.equal(null);
  });

  it('returns the record for a deactivated user rather than hiding it', async () => {
    // refusalFor() owns the deactivated decision; the lookup must surface the
    // record so that decision can be made.
    const db = fakeDb(docs);
    const actual = await findUserByEmail(db, 'off@bluecoreresidential.com');
    expect(actual).to.include({ id: 'off', isDisabled: true });
  });

  it('short-circuits an empty email without querying at all', async () => {
    const db = fakeDb(docs);
    expect(await findUserByEmail(db, '')).to.equal(null);
    expect(db.calls.exact).to.equal(0);
    expect(db.calls.scan).to.equal(0);
  });
});
