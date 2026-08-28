/**
 * Sparkle auth gate.
 *
 * Sparkle is internal and invite-only. Enabling the Google sign-in provider
 * means anyone with a Google account can present valid credentials to Firebase,
 * so this blocking function is what keeps "signing in with Google never creates
 * an account" true. It runs before Firebase will mint a new auth account and
 * refuses any address that an administrator has not already added.
 *
 * Note what this does NOT gate: an existing Sparkle user linking Google to
 * their existing account. Firebase's "one account per email address" setting
 * links a verified Google identity to the account that already owns that email
 * and reuses its uid, which never reaches beforeUserCreated. That is the
 * intended path -- every uid in Firestore, every custom claim, every push
 * registration token and all historical attribution is keyed by uid, so a new
 * uid for an existing person would silently orphan all of it.
 *
 * This lives in its own Functions codebase rather than in ../functions because
 * that codebase pins firebase-functions 3.15.6 on the Node 10 runtime, and
 * blocking functions need >= 3.20. Bumping it would put ~40 deployed functions
 * at risk for one small addition.
 *
 * Deploy with: firebase deploy --only functions:auth-gate
 */

const admin = require('firebase-admin');
const {
  beforeUserCreated,
  HttpsError,
} = require('firebase-functions/v2/identity');
const logger = require('firebase-functions/logger');
const { findUserByEmail } = require('./user-lookup');
const { refusalFor } = require('./membership');

admin.initializeApp();
const db = admin.firestore();

// Match the region the rest of Sparkle's functions run in
const REGION = 'us-central1';

exports.beforeCreateUser = beforeUserCreated(
  { region: REGION },
  async event => {
    const user = (event && event.data) || {};
    const email = user.email || '';
    const providerId =
      (event && event.credential && event.credential.providerId) || '';

    let match = null;
    try {
      match = await findUserByEmail(db, email);
    } catch (err) {
      // Fail closed. If we cannot prove membership we do not grant it: a
      // Firestore outage must not become an open registration window.
      logger.error('auth-gate: membership lookup failed', {
        email,
        providerId,
        error: err.message,
      });
      throw new HttpsError(
        'internal',
        'Sparkle could not verify your account right now. Please try again shortly.'
      );
    }

    const refusal = refusalFor({ email, match, providerId });

    if (refusal) {
      logger.warn('auth-gate: refused sign-up', {
        email,
        providerId,
        reason: refusal,
      });
      throw new HttpsError('permission-denied', refusal);
    }

    logger.info('auth-gate: allowed sign-up', {
      email,
      providerId,
      userId: match.id,
    });

    // Returning nothing accepts the account unmodified.
  }
);
