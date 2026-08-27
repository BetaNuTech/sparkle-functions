/**
 * Repair the two-sided property <-> template relationship.
 *
 * Each association is stored twice:
 *   1. `properties/{id}.templates`  = { templateId: true }   (source of truth)
 *   2. `templates/{id}.properties`  = [ propertyId ]         (mirror)
 *
 * Both clients query the mirror (`where('properties', 'array-contains', id)`),
 * and iOS additionally requires the property-side entry. So a template with a
 * stale mirror is invisible in "Select a Template" on web AND iOS, while still
 * appearing in the property edit screen — which reads the property side only.
 *
 * This script rebuilds the mirror from the property side:
 *   MISSING  property assigns the template, mirror does not list the property
 *            -> add propertyId to `template.properties`   (fixes hidden templates)
 *   GHOST    mirror lists the property, property no longer assigns the template
 *            -> remove propertyId from `template.properties`
 *   ORPHAN   property assigns a template document that no longer exists
 *            -> reported only, unless --prune-orphan-templates is passed
 *   DANGLING mirror lists a property document that no longer exists
 *            -> reported only, unless --prune-deleted-properties is passed
 *
 * Usage (dry run by default — prints planned changes, writes nothing):
 *   node repair-template-property-links.js --project sapphire-inspections-staging
 *   node repair-template-property-links.js --project sapphire-inspections --apply
 *   GOOGLE_APPLICATION_CREDENTIALS=... node repair-template-property-links.js --project X
 *
 * Flags:
 *   --apply                        perform the writes (default: dry run)
 *   --property <id>                limit the repair to a single property
 *   --prune-orphan-templates       also drop property assignments of deleted templates
 *   --prune-deleted-properties     also drop mirror entries for deleted properties
 */

/* eslint-disable no-console */
const admin = require('firebase-admin');

const BATCH_LIMIT = 450; // firestore caps a batch at 500 writes

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PRUNE_DELETED = args.includes('--prune-deleted-properties');
const PRUNE_ORPHANS = args.includes('--prune-orphan-templates');
const projectIdx = args.indexOf('--project');
const PROJECT_ID = projectIdx !== -1 ? args[projectIdx + 1] : '';
const propertyIdx = args.indexOf('--property');
const ONLY_PROPERTY = propertyIdx !== -1 ? args[propertyIdx + 1] : '';

if (!PROJECT_ID) {
  console.error(
    'Usage: node repair-template-property-links.js --project <project-id> [--property <id>] [--apply] [--prune-deleted-properties]'
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const {
  arrayUnion,
  arrayRemove,
  delete: deleteField,
} = admin.firestore.FieldValue;

// Group planned changes by template so each template
// takes a single write no matter how many properties changed
function planFor(plans, templateId, templateName) {
  if (!plans.has(templateId)) {
    plans.set(templateId, { templateId, templateName, add: [], remove: [] });
  }
  return plans.get(templateId);
}

(async () => {
  console.log(`Project:  ${PROJECT_ID}`);
  console.log(
    `Mode:     ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}`
  );
  if (ONLY_PROPERTY) console.log(`Property: ${ONLY_PROPERTY} (only)`);
  console.log('');

  const [propsSnap, tmplSnap] = await Promise.all([
    db.collection('properties').get(),
    db.collection('templates').get(),
  ]);

  const properties = new Map(); // propertyId -> {name, templateIds}
  propsSnap.docs.forEach(doc => {
    properties.set(doc.id, {
      name: doc.get('name') || '(unnamed)',
      templateIds: Object.keys(doc.get('templates') || {}),
    });
  });

  const templates = new Map(); // templateId -> {name, propertyIds}
  tmplSnap.docs.forEach(doc => {
    templates.set(doc.id, {
      name: doc.get('name') || '(unnamed)',
      propertyIds: doc.get('properties') || [],
    });
  });

  const targets = ONLY_PROPERTY
    ? [...properties.keys()].filter(id => id === ONLY_PROPERTY)
    : [...properties.keys()];

  if (ONLY_PROPERTY && targets.length === 0) {
    console.error(`No property found with id "${ONLY_PROPERTY}".`);
    process.exit(1);
  }

  const plans = new Map(); // templateId -> {add: [propId], remove: [propId]}
  const orphans = []; // property assigns a template that no longer exists
  const report = []; // per property lines

  targets.forEach(propertyId => {
    const property = properties.get(propertyId);
    const assigned = property.templateIds;
    const missing = [];
    const ghosts = [];

    assigned.forEach(templateId => {
      const template = templates.get(templateId);

      if (!template) {
        orphans.push({ propertyId, propertyName: property.name, templateId });
        return;
      }

      if (!template.propertyIds.includes(propertyId)) {
        missing.push({ templateId, templateName: template.name });
        planFor(plans, templateId, template.name).add.push(propertyId);
      }
    });

    templates.forEach((template, templateId) => {
      if (template.propertyIds.includes(propertyId) && !assigned.includes(templateId)) {
        ghosts.push({ templateId, templateName: template.name });
        planFor(plans, templateId, template.name).remove.push(propertyId);
      }
    });

    if (missing.length || ghosts.length) {
      report.push({ propertyId, property, missing, ghosts });
    }
  });

  // Mirror entries pointing at properties that no longer exist
  const dangling = new Map(); // templateId -> [propertyId]
  templates.forEach((template, templateId) => {
    const gone = template.propertyIds.filter(id => !properties.has(id));
    if (gone.length) dangling.set(templateId, gone);
  });

  // Report
  if (report.length === 0) {
    console.log('No broken property <-> template links found.');
  } else {
    report.forEach(({ propertyId, property, missing, ghosts }) => {
      console.log(`${property.name}  (${propertyId})`);
      console.log(
        `  ${property.templateIds.length} assigned | ${missing.length} hidden from apps | ${ghosts.length} ghost`
      );
      missing.forEach(t =>
        console.log(`    + ADD    ${t.templateId}  ${t.templateName}`)
      );
      ghosts.forEach(t =>
        console.log(`    - REMOVE ${t.templateId}  ${t.templateName}`)
      );
      console.log('');
    });
  }

  if (orphans.length) {
    console.log(
      `${orphans.length} assigned template(s) no longer exist${
        PRUNE_ORPHANS
          ? ' — will be removed from their propert(ies)'
          : ' — pass --prune-orphan-templates to clean up'
      }:`
    );
    orphans.forEach(o =>
      console.log(`  ${o.propertyName} (${o.propertyId}) -> ${o.templateId}`)
    );
    console.log('');
  }

  if (dangling.size) {
    const total = [...dangling.values()].reduce((sum, ids) => sum + ids.length, 0);
    console.log(
      `${total} mirror entr(ies) across ${dangling.size} template(s) point at deleted properties${
        PRUNE_DELETED ? ' — will be pruned' : ' — pass --prune-deleted-properties to clean up'
      }.`
    );
    if (PRUNE_DELETED) {
      dangling.forEach((propertyIds, templateId) => {
        const template = templates.get(templateId);
        planFor(plans, templateId, template.name).remove.push(...propertyIds);
      });
    }
    console.log('');
  }

  const writes = [...plans.values()].filter(p => p.add.length || p.remove.length);
  // Property-side cleanup: drop assignments of templates that no longer exist
  const orphanWrites = PRUNE_ORPHANS ? orphans : [];

  if (writes.length === 0 && orphanWrites.length === 0) {
    console.log('Nothing to write.');
    process.exit(0);
  }

  if (writes.length) {
    console.log(
      `${writes.length} template document(s) to update, ${writes.reduce(
        (sum, p) => sum + p.add.length + p.remove.length,
        0
      )} relationship change(s) total.`
    );
  }
  if (orphanWrites.length) {
    console.log(
      `${orphanWrites.length} orphaned template assignment(s) to remove from properties.`
    );
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to perform these changes.');
    process.exit(0);
  }

  // Apply — arrayUnion/arrayRemove are idempotent, so a partial
  // run is safe to repeat. Adds and removes for the same template
  // go in separate writes: one update cannot union and remove the
  // same field at once
  console.log('\nApplying changes...');
  let batch = db.batch();
  let batched = 0;
  let updated = 0;

  const commit = async () => {
    if (batched === 0) return;
    await batch.commit();
    batch = db.batch();
    batched = 0;
  };

  for (const plan of writes) {
    const docRef = db.collection('templates').doc(plan.templateId);

    if (plan.add.length) {
      batch.update(docRef, { properties: arrayUnion(...plan.add) });
      batched += 1;
    }
    if (plan.remove.length) {
      batch.update(docRef, { properties: arrayRemove(...plan.remove) });
      batched += 1;
    }
    updated += 1;

    if (batched >= BATCH_LIMIT) {
      // eslint-disable-next-line no-await-in-loop
      await commit();
    }
  }

  for (const orphan of orphanWrites) {
    const docRef = db.collection('properties').doc(orphan.propertyId);
    batch.update(docRef, { [`templates.${orphan.templateId}`]: deleteField() });
    batched += 1;

    if (batched >= BATCH_LIMIT) {
      // eslint-disable-next-line no-await-in-loop
      await commit();
    }
  }

  await commit();

  orphanWrites.forEach(orphan =>
    console.log(
      `  OK   ${orphan.propertyName} - removed orphaned template ${orphan.templateId}`
    )
  );
  writes.forEach(plan =>
    console.log(
      `  OK   ${plan.templateName} (+${plan.add.length} / -${plan.remove.length})`
    )
  );
  console.log(
    `\nDone. ${updated} template(s) updated${
      orphanWrites.length
        ? `, ${orphanWrites.length} orphaned assignment(s) removed`
        : ''
    }.`
  );
  process.exit(0);
})().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
