const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('../setup');

describe('Inspections | Updated Last Date Write', () => {
  afterEach(() => cleanDb(db));

  it("should update all an inspections' outdated proxy records", async () => {
    const inspectionId = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const now = Date.now() / 1000;
    const inspectionData = {
      templateName: `name${inspectionId}`,
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
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db
      .ref(`/inspections/${inspectionId}`)
      .set(Object.assign({}, inspectionData, { updatedLastDate: now - 1000 })); // Add inspection with old updated date
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}/updatedLastDate`)
      .once('value');
    await db.ref(`/inspections/${inspectionId}/updatedLastDate`).set(now);
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}/updatedLastDate`)
      .once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test results
    const propertyInspectionProxy = await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`)
      .once('value');
    const completedInspectionProxy = await db
      .ref(`/completedInspectionsList/${inspectionId}`)
      .once('value');

    // Assertions
    const expected = Object.assign({}, inspectionData);
    delete expected.property;
    expect(propertyInspectionProxy.val()).to.deep.equal(
      expected,
      'updated /propertyInspectionsList proxy'
    );

    const expectedCompleted = Object.assign({}, inspectionData);
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    delete expectedCompleted.templateCategory;
    expect(completedInspectionProxy.val()).to.deep.equal(
      expectedCompleted,
      'updated /completedInspectionsList proxy'
    );
  });

  it("should update property with any meta data from its' completed inspections", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = Date.now() / 1000;
    const oldest = Date.now() / 1000 - 100000;
    const inspectionOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
    });
    const inspectionTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
    });
    const expected = {
      numOfInspections: 2,
      lastInspectionScore: inspectionOne.score,
      lastInspectionDate: inspectionOne.creationDate,
    };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db.ref(`/inspections/${insp1Id}`).set(inspectionOne); // Add inspection #1
    await db.ref(`/inspections/${insp2Id}`).set(inspectionTwo); // Add inspection #2
    const beforeSnap = await db
      .ref(`/inspections/${insp1Id}/updatedLastDate`)
      .once('value');
    await db.ref(`/inspections/${insp1Id}/updatedLastDate`).set(newest);
    const afterSnap = await db
      .ref(`/inspections/${insp1Id}/updatedLastDate`)
      .once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
    await wrapped(changeSnap, { params: { inspectionId: insp1Id } });

    // Test result
    const propertySnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value');
    const actual = propertySnap.val();

    // Assertions
    expect(actual.numOfInspections).to.equal(
      expected.numOfInspections,
      "updated property's `numOfInspections`"
    );
    expect(actual.lastInspectionScore).to.equal(
      expected.lastInspectionScore,
      "updated property's `lastInspectionScore`"
    );
    expect(actual.lastInspectionDate).to.equal(
      expected.lastInspectionDate,
      "updated property's `lastInspectionDate`"
    );
  });
});
