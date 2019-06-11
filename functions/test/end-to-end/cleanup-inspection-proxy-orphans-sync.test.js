const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Cleanup Inspection Proxy Orphans Sync', () => {
  afterEach(() => cleanDb(db));

  it('should remove all property-inspection proxies of an archived property', async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const insp3Id = uuid();
    const archivedPropertyId = uuid();
    const activePropertyId = uuid();
    const inspectionOne = mocking.createInspection({
      property: archivedPropertyId,
    });
    const inspectionTwo = mocking.createInspection({
      property: archivedPropertyId,
    });
    const inspectionThree = mocking.createInspection({
      property: activePropertyId,
    });

    // Setup database
    await db.ref(`/inspections/${insp1Id}`).set(inspectionOne);
    await db
      .ref(`/propertyInspections/${archivedPropertyId}/inspections/${insp1Id}`)
      .set(inspectionOne); // TODO remove #53
    await db
      .ref(
        `/propertyInspectionsList/${archivedPropertyId}/inspections/${insp1Id}`
      )
      .set(inspectionOne);
    await db.ref(`/inspections/${insp2Id}`).set(inspectionTwo); // sanity check
    await db
      .ref(`/propertyInspections/${archivedPropertyId}/inspections/${insp2Id}`)
      .set(inspectionTwo); // TODO remove #53
    await db
      .ref(
        `/propertyInspectionsList/${archivedPropertyId}/inspections/${insp2Id}`
      )
      .set(inspectionTwo);
    await db.ref(`/inspections/${insp3Id}`).set(inspectionThree); // sanity check
    await db
      .ref(`/propertyInspections/${activePropertyId}/inspections/${insp3Id}`)
      .set(inspectionThree); // TODO remove #53
    await db
      .ref(
        `/propertyInspectionsList/${activePropertyId}/inspections/${insp3Id}`
      )
      .set(inspectionThree);
    await db
      .ref(`/properties/${activePropertyId}`)
      .set({ name: `name${activePropertyId}` }); // sanity check

    // Execute
    const wrapped = test.wrap(cloudFunctions.cleanupInspectionProxyOrphansSync);
    await wrapped();

    // Test result
    const actual = await Promise.all([
      db.ref(`/propertyInspections/${archivedPropertyId}`).once('value'), // TODO remove #53
      db.ref(`/propertyInspectionsList/${archivedPropertyId}`).once('value'),
      db.ref(`/propertyInspections/${activePropertyId}`).once('value'), // TODO remove #53
      db.ref(`/propertyInspectionsList/${activePropertyId}`).once('value'),
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([
      false,
      false,
      true,
      true,
    ]);
  });

  it('should remove all inspection proxies of an archived inspection', async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const activeInspection = mocking.createInspection({ property: propertyId });
    const archivedInspection = mocking.createInspection({
      property: propertyId,
    });
    delete activeInspection.template; // template non included in proxies
    const expected = { [insp1Id]: activeInspection };

    // Setup database
    await db.ref(`/inspections/${insp1Id}`).set(activeInspection); // create active inspection
    await db
      .ref(`/propertyInspections/${propertyId}/inspections/${insp1Id}`)
      .set(activeInspection); // TODO remove #53
    await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${insp1Id}`)
      .set(activeInspection);
    await db
      .ref(`/propertyInspections/${propertyId}/inspections/${insp2Id}`)
      .set(archivedInspection); // TODO remove #53
    await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${insp2Id}`)
      .set(archivedInspection);
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // sanity check

    // Execute
    const wrapped = test.wrap(cloudFunctions.cleanupInspectionProxyOrphansSync);
    await wrapped();

    // Test result
    const results = await Promise.all([
      db.ref(`/propertyInspections/${propertyId}/inspections`).once('value'), // TODO remove #53
      db
        .ref(`/propertyInspectionsList/${propertyId}/inspections`)
        .once('value'),
    ]);

    // Assertions
    results
      .map(r => r.val())
      .forEach(actual => expect(actual).to.deep.equal(expected));
  });

  it('should remove all completed inspection proxies of an archived inspection', async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const activeInspection = mocking.createInspection({ property: propertyId });
    const archivedInspection = mocking.createInspection({
      property: propertyId,
    });

    // Setup database
    await db.ref(`/inspections/${insp1Id}`).set(activeInspection); // create active inspection
    await db.ref(`/completedInspections/${insp1Id}`).set(activeInspection); // TODO remove #53
    await db.ref(`/completedInspectionsList/${insp1Id}`).set(activeInspection);
    await db.ref(`/completedInspections/${insp2Id}`).set(archivedInspection); // TODO remove #53
    await db
      .ref(`/completedInspectionsList/${insp2Id}`)
      .set(archivedInspection);
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // sanity check

    // Execute
    const wrapped = test.wrap(cloudFunctions.cleanupInspectionProxyOrphansSync);
    await wrapped();

    // Test result
    const actual = await Promise.all([
      db.ref(`/completedInspections/${insp1Id}`).once('value'), // TODO remove #53
      db.ref(`/completedInspectionsList/${insp1Id}`).once('value'),
      db.ref(`/completedInspections/${insp2Id}`).once('value'), // TODO remove #53
      db.ref(`/completedInspectionsList/${insp2Id}`).once('value'),
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([
      true,
      true,
      false,
      false,
    ]);
  });
});
