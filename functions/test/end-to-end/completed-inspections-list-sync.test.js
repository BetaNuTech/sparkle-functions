const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Completed Inspections List Sync', () => {
  afterEach(() => cleanDb(db));

  it('should create new inspection proxy records', async () => {
    const inspId = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const now = Date.now() / 1000;
    const inspectionData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      templateCategory: categoryId,
      updatedLastDate: now,
      inspectionCompleted: true,
    };

    // Setup database
    await db.ref(`/inspections/${inspId}`).set(inspectionData);
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check

    // Execute
    const wrapped = test.wrap(cloudFunctions.completedInspectionsListSync);
    await wrapped();

    // Test result
    const actual = await Promise.all([
      db.ref(`/completedInspections/${inspId}`).once('value'), // TODO remove #53
      db.ref(`/completedInspectionsList/${inspId}`).once('value'),
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([true, true]);
  });

  it("should update all an inspections' outdated proxy records", async () => {
    const inspId = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const now = Date.now() / 1000;
    const newInspection = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      templateCategory: categoryId,
      updatedLastDate: now,
      inspectionCompleted: true,
    };
    const oldInspection = Object.assign({}, newInspection, {
      updatedLastDate: now - 1000,
    });
    delete oldInspection.templateCategory;

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/inspections/${inspId}`).set(newInspection);
    await db.ref(`/completedInspections/${inspId}`).set(oldInspection); // TODO remove #53
    await db.ref(`/completedInspectionsList/${inspId}`).set(oldInspection);

    // Execute
    const wrapped = test.wrap(cloudFunctions.completedInspectionsListSync);
    await wrapped();

    // Test result
    const completedInspection = await db
      .ref(`/completedInspections/${inspId}`)
      .once('value'); // TODO remove #53
    const completedInspectionList = await db
      .ref(`/completedInspectionsList/${inspId}`)
      .once('value');

    // Assertions
    const expected = Object.assign({}, newInspection);
    delete expected.itemsCompleted;
    delete expected.totalItems;
    delete expected.templateCategory;
    expect(completedInspection.val()).to.deep.equal(
      expected,
      'updated /completedInspections proxy'
    ); // TODO remove #53
    expect(completedInspectionList.val()).to.deep.equal(
      expected,
      'updated /completedInspectionsList proxy'
    );
  });

  it('should remove a completedInspection that becomes incomplete', async () => {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const newInspection = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now,
      inspectionCompleted: false,
    };
    const oldInspection = Object.assign({}, newInspection, {
      inspectionCompleted: true,
      updatedLastDate: now - 1000,
    });

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db.ref(`/inspections/${inspId}`).set(newInspection);
    await db.ref(`/completedInspections/${inspId}`).set(oldInspection); // TODO remove #53
    await db.ref(`/completedInspectionsList/${inspId}`).set(oldInspection);

    // Execute
    const wrapped = test.wrap(cloudFunctions.completedInspectionsListSync);
    await wrapped();

    // Test results
    const actual = await db
      .ref(`/completedInspections/${inspId}`)
      .once('value'); // TODO remove #53
    const actualList = await db
      .ref(`/completedInspectionsList/${inspId}`)
      .once('value');

    // Assertions
    expect(actual.exists()).to.equal(
      false,
      'removed /completedInspections proxy'
    ); // TODO remove #53
    expect(actualList.exists()).to.equal(
      false,
      'removed /completedInspectionsList proxy'
    );
  });

  it('should not create proxy records for inspections belonging to a deleted property', async () => {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const inspectionData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now,
      inspectionCompleted: true,
    };

    // Setup database
    await db.ref(`/inspections/${inspId}`).set(inspectionData);

    // Execute
    const wrapped = test.wrap(cloudFunctions.completedInspectionsListSync);
    await wrapped();

    // Test results
    const actual = await Promise.all([
      db.ref(`/completedInspections/${inspId}`).once('value'), // TODO remove #53
      db.ref(`/completedInspectionsList/${inspId}`).once('value'),
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([false, false]);
  });
});
