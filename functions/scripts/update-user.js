const log = require('../utils/logger');
const { fs: db, auth } = require('./setup'); // eslint-disable-line
const usersModel = require('../models/users');

const [, , userId] = process.argv; // eslint-disable-line
if (!userId) {
  throw Error('User ID not provided');
}

const claimsUpdates = {};
process.argv.slice(2).forEach(val => {
  const [attr, valueSrc] = val.split('=');
  const value = `${valueSrc || ''}`.toLowerCase() === 'true';
  if (attr === 'admin' || attr === 'corporate') {
    claimsUpdates[attr] = value;
  }
});

const hasClaimsUpdate = Boolean(Object.keys(claimsUpdates).length);
if (!hasClaimsUpdate) {
  throw Error('must provide an admin or corporate update (ie admin=true)');
}
// Reject setting to Corprate/Admin
if (claimsUpdates.admin && claimsUpdates.corporate) {
  throw Error('must not set an admin/corporate user');
}

// Replace incompatible permissions
if (claimsUpdates.admin) {
  claimsUpdates.corporate = false;
}
if (claimsUpdates.corporate) {
  claimsUpdates.admin = false;
}

(async () => {
  // Check target user exists
  let targetAuthUser = null;
  try {
    targetAuthUser = await usersModel.getAuthUser(auth, userId);
  } catch (err) {
    throw Error(`failed to lookup auth user | ${err}`);
  }

  if (!targetAuthUser) {
    throw Error(`auth user "${userId}" does not exist`);
  }

  // Update target user's Custom Claims
  try {
    await usersModel.upsertCustomClaims(auth, userId, claimsUpdates);
  } catch (err) {
    throw Error(`user claims update failed | ${err}`);
  }

  try {
    // Update Firestore
    await usersModel.firestoreUpsertRecord(db, userId, claimsUpdates);
  } catch (err) {
    throw Error(`failed to complete user record update | ${err}`);
  }

  log.info('Completed user update successfully');
  process.exit();
})();
