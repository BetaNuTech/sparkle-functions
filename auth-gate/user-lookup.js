/**
 * Firestore lookup backing the Sparkle auth gate.
 *
 * Kept apart from `membership.js` so the decision logic stays pure and
 * testable; everything that touches Firestore lives here.
 */

const { normalizeEmail, matchUser } = require('./membership');

const USERS_COLLECTION = 'users';

// Upper bound on the fallback scan below. Sparkle is an internal, invite-only
// application with a user base in the dozens, so this is far above any real
// value -- it exists so the query can never become unbounded work.
const SCAN_LIMIT = 1000;

/**
 * @param  {firestore.QueryDocumentSnapshot} doc
 * @return {Object} - { id, email, isDisabled }
 */
function toRecord(doc) {
  const data = doc.data() || {};
  return { id: doc.id, email: data.email, isDisabled: data.isDisabled };
}

/**
 * Look up the Sparkle user record for an email address.
 *
 * @param  {admin.firestore} db
 * @param  {String} email
 * @return {Promise<Object|null>} - { id, email, isDisabled } or null
 */
async function findUserByEmail(db, email) {
  const target = normalizeEmail(email);
  if (!target) return null;

  // Fast path: indexed equality. Covers every account whose stored email is
  // already lowercase, which is the overwhelmingly common case.
  const exact = await db
    .collection(USERS_COLLECTION)
    .where('email', '==', target)
    .limit(1)
    .get();

  if (!exact.empty) {
    return toRecord(exact.docs[0]);
  }

  // Slow path. Stored emails are whatever an administrator typed into
  // POST /v0/users, so one may be mixed case, and Firestore cannot query
  // case-insensitively. This only runs when the fast path misses -- an
  // uninvited sign-up attempt, or a legitimate user with unusual casing -- so
  // it is rare, bounded, and reads two fields per document.
  const scan = await db
    .collection(USERS_COLLECTION)
    .select('email', 'isDisabled')
    .limit(SCAN_LIMIT)
    .get();

  return matchUser(target, scan.docs.map(toRecord));
}

module.exports = { findUserByEmail, USERS_COLLECTION, SCAN_LIMIT };
