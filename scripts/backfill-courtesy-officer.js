/**
 * One-off backfill: ensure every Firestore `users/{uid}` doc has a
 * `courtesyOfficer` boolean.
 *
 * Why: `courtesyOfficer` is a new user field. Docs created before it existed
 * have no value (undefined). The web client's user-edit form diffs form values
 * against the stored doc, so an `undefined` stored value vs the form's `false`
 * default makes the field look "changed" and get sent on EVERY save — including
 * non-admin self-profile edits, which the API rejects (401) because
 * `courtesyOfficer` is an admin-only field. Backfilling `false` makes the stored
 * value match the default so untouched saves omit it.
 *
 * Idempotent: only writes docs missing the field; safe to re-run.
 *
 * Usage (dry run by default — prints planned changes, writes nothing):
 *   GOOGLE_APPLICATION_CREDENTIALS=... node backfill-courtesy-officer.js --project sapphire-inspections-staging
 *   node backfill-courtesy-officer.js --project sapphire-inspections-staging          # uses ADC
 *   node backfill-courtesy-officer.js --project sapphire-inspections-staging --apply  # performs writes
 */

/* eslint-disable no-console */
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const projectIdx = args.indexOf('--project');
const PROJECT_ID = projectIdx !== -1 ? args[projectIdx + 1] : '';

if (!PROJECT_ID) {
  console.error(
    'Usage: node backfill-courtesy-officer.js --project <project-id> [--apply]'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
  console.log(`Project:  ${PROJECT_ID}`);
  console.log(
    `Mode:     ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}`
  );
  console.log('');

  const usersSnap = await db.collection('users').get();
  const missing = usersSnap.docs.filter(
    d => typeof d.get('courtesyOfficer') !== 'boolean'
  );

  if (missing.length === 0) {
    console.log('All user docs already have a courtesyOfficer flag. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${missing.length} user doc(s) missing courtesyOfficer:\n`);
  missing.forEach(d =>
    console.log(`  ${d.get('email') || '(no email)'}   uid=${d.id}`)
  );

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to set courtesyOfficer: false.');
    process.exit(0);
  }

  console.log('\nApplying changes...');
  let failures = 0;
  for (const d of missing) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.collection('users').doc(d.id).update({ courtesyOfficer: false });
      console.log(`  OK   uid=${d.id}`);
    } catch (err) {
      failures += 1;
      console.error(`  FAIL uid=${d.id}: ${err.message}`);
    }
  }

  console.log(
    `\nDone. ${missing.length - failures}/${missing.length} updated${
      failures ? `, ${failures} FAILED` : ''
    }.`
  );
  process.exit(failures ? 1 : 0);
})().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
