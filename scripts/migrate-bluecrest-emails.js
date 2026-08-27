/**
 * One-off migration: bluecrestresidential.com -> bluecoreresidential.com
 *
 * Updates every matching email in BOTH:
 *   1. Firebase Auth (login identity)
 *   2. Firestore `users/{uid}.email`
 *
 * Special case: jhalsey@bluecrestresidential.com -> julie@bluecoreresidential.com
 *
 * Usage (dry run by default — prints planned changes, writes nothing):
 *   GOOGLE_APPLICATION_CREDENTIALS=... node migrate-bluecrest-emails.js --project sapphire-inspections-staging
 *   node migrate-bluecrest-emails.js --project sapphire-inspections-staging          # uses ADC
 *   node migrate-bluecrest-emails.js --project sapphire-inspections-staging --apply  # performs writes
 */

/* eslint-disable no-console */
const admin = require('firebase-admin');

const OLD_DOMAIN = 'bluecrestresidential.com';
const NEW_DOMAIN = 'bluecoreresidential.com';
const SPECIAL_CASES = {
  // old local part -> new local part
  jhalsey: 'julie',
};

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const projectIdx = args.indexOf('--project');
const PROJECT_ID = projectIdx !== -1 ? args[projectIdx + 1] : '';

if (!PROJECT_ID) {
  console.error(
    'Usage: node migrate-bluecrest-emails.js --project <project-id> [--apply]'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();

function matchesOldDomain(email) {
  return (
    typeof email === 'string' &&
    email.toLowerCase().endsWith(`@${OLD_DOMAIN}`)
  );
}

function newEmailFor(email) {
  const localPart = email.slice(0, email.toLowerCase().lastIndexOf(`@${OLD_DOMAIN}`));
  const mappedLocal = SPECIAL_CASES[localPart.toLowerCase()] || localPart;
  return `${mappedLocal.toLowerCase()}@${NEW_DOMAIN}`;
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

(async () => {
  console.log(`Project:  ${PROJECT_ID}`);
  console.log(`Mode:     ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}`);
  console.log('');

  // 1. Collect matching Firebase Auth users
  const allAuthUsers = await listAllAuthUsers();
  const authMatches = allAuthUsers.filter(u => matchesOldDomain(u.email));

  // 2. Collect matching Firestore user docs (suffix queries aren't
  //    supported, so scan the collection and filter locally)
  const usersSnap = await db.collection('users').get();
  const docMatches = usersSnap.docs.filter(d => matchesOldDomain(d.get('email')));

  // 3. Build the change plan keyed by uid
  const plan = new Map(); // uid -> {uid, oldEmail, newEmail, inAuth, inFirestore, emailVerified}
  authMatches.forEach(u => {
    plan.set(u.uid, {
      uid: u.uid,
      oldEmail: u.email,
      newEmail: newEmailFor(u.email),
      inAuth: true,
      inFirestore: false,
      emailVerified: u.emailVerified,
    });
  });
  docMatches.forEach(d => {
    const existing = plan.get(d.id);
    if (existing) {
      existing.inFirestore = true;
    } else {
      const oldEmail = d.get('email');
      plan.set(d.id, {
        uid: d.id,
        oldEmail,
        newEmail: newEmailFor(oldEmail),
        inAuth: false,
        inFirestore: true,
        emailVerified: undefined,
      });
    }
  });

  if (plan.size === 0) {
    console.log(`No emails matching @${OLD_DOMAIN} found. Nothing to do.`);
    process.exit(0);
  }

  // 4. Collision check: does any target email already exist in Auth?
  const collisions = [];
  for (const change of plan.values()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const existing = await auth.getUserByEmail(change.newEmail);
      if (existing.uid !== change.uid) {
        collisions.push({ ...change, conflictUid: existing.uid });
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }

  // 5. Report
  console.log(`Found ${plan.size} account(s) to update:\n`);
  for (const c of plan.values()) {
    const places = [c.inAuth && 'Auth', c.inFirestore && 'Firestore']
      .filter(Boolean)
      .join(' + ');
    console.log(`  ${c.oldEmail}  ->  ${c.newEmail}   [${places}]  uid=${c.uid}`);
  }
  if (collisions.length) {
    console.log('\nBLOCKED — target email already taken by another account:');
    collisions.forEach(c =>
      console.log(`  ${c.newEmail} already belongs to uid=${c.conflictUid}`)
    );
    console.log('Resolve these before applying. No changes made.');
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to perform these changes.');
    process.exit(0);
  }

  // 6. Apply: Auth first (the login identity), then the Firestore doc
  console.log('\nApplying changes...');
  let failures = 0;
  for (const c of plan.values()) {
    try {
      if (c.inAuth) {
        // preserve emailVerified — admin SDK resets it to false otherwise
        // eslint-disable-next-line no-await-in-loop
        await auth.updateUser(c.uid, {
          email: c.newEmail,
          emailVerified: !!c.emailVerified,
        });
      }
      if (c.inFirestore) {
        // eslint-disable-next-line no-await-in-loop
        await db.collection('users').doc(c.uid).update({ email: c.newEmail });
      }
      console.log(`  OK   ${c.oldEmail} -> ${c.newEmail}`);
    } catch (err) {
      failures += 1;
      console.error(`  FAIL ${c.oldEmail}: ${err.message}`);
    }
  }

  console.log(
    `\nDone. ${plan.size - failures}/${plan.size} updated${
      failures ? `, ${failures} FAILED` : ''
    }.`
  );
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
