/**
 * Membership decisions for Sparkle's Firebase Auth blocking functions.
 *
 * Deliberately pure: no Firestore, no Firebase Admin, no network. Everything
 * here is a plain function over plain data so the gate's logic can be unit
 * tested without an emulator. The impure lookup lives in `user-lookup.js` and
 * the wiring in `index.js`.
 *
 * There is no user creation in this module, or anywhere else in this codebase,
 * and there must never be one. Sparkle is invite-only: an unknown address is a
 * refusal, not a signup. The only way to become a user is an administrator
 * calling POST /v0/users.
 */

const REFUSALS = {
  unknownGoogle:
    'That Google account is not set up in Sparkle. Please ask an administrator to add you.',
  unknown:
    'That account is not set up in Sparkle. Please ask an administrator to add you.',
  deactivated:
    'This account has been deactivated. Please contact an administrator.',
  missingEmail:
    'Sparkle could not read a verified email address for that account, so we cannot sign you in with it.',
};

/**
 * Normalize an email for comparison
 * @param  {String} email
 * @return {String} - trimmed, lowercased email (empty string when absent)
 */
function normalizeEmail(email) {
  return `${email || ''}`.trim().toLowerCase();
}

/**
 * Find the user record matching an email, case-insensitively.
 *
 * Stored emails are whatever an administrator typed into POST /v0/users, while
 * Google hands back a lowercased address, so an exact string comparison is not
 * safe to rely on by itself.
 *
 * @param  {String} email
 * @param  {Object[]} userRecords - [{ id, email, isDisabled }]
 * @return {Object|null}
 */
function matchUser(email, userRecords) {
  const target = normalizeEmail(email);
  if (!target) return null;

  const candidates = userRecords || [];
  for (let i = 0; i < candidates.length; i += 1) {
    const record = candidates[i];
    if (record && normalizeEmail(record.email) === target) {
      return record;
    }
  }

  return null;
}

/**
 * Decide whether an account creation may proceed.
 *
 * @param  {Object} args
 * @param  {String} args.email - email on the incoming auth event
 * @param  {Object|null} args.match - matching user record, or null
 * @param  {String} args.providerId - e.g. "google.com" (only shapes the copy)
 * @return {String|null} - refusal message, or null to allow
 */
function refusalFor({ email, match, providerId } = {}) {
  if (!normalizeEmail(email)) {
    return REFUSALS.missingEmail;
  }

  if (!match) {
    return providerId === 'google.com'
      ? REFUSALS.unknownGoogle
      : REFUSALS.unknown;
  }

  if (match.isDisabled === true) {
    return REFUSALS.deactivated;
  }

  return null; // allowed
}

module.exports = { REFUSALS, normalizeEmail, matchUser, refusalFor };
