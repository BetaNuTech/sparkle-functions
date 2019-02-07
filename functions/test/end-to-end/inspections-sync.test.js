const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Inspections Sync', () => {
  afterEach(() => cleanDb(db));

  it('should create new inspection proxy records', () => co(function *() {
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
      inspectionCompleted: true
    };

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(inspectionData);
    yield db.ref(`/properties/${propertyId}`).set({ inspections: { [inspId]: inspectionData } });

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Test result
    const actual = yield Promise.all([
      db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value'),
      db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value'),
      db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).once('value'),
      db.ref(`/completedInspections/${inspId}`).once('value'),
      db.ref(`/completedInspectionsList/${inspId}`).once('value')
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([true, true, true, true, true]);
  }));

  it('should update all an inspections\' outdated proxy records', () => co(function *() {
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
      inspectionCompleted: true
    };
    const oldInspection = Object.assign({}, newInspection, { updatedLastDate: now - 1000 })

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(newInspection);
    yield db.ref(`/properties/${propertyId}`).set({ inspections: { [inspId]: oldInspection } });
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).set(oldInspection);
    yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).set(oldInspection);
    yield db.ref(`/completedInspections/${inspId}`).set(oldInspection);
    yield db.ref(`/completedInspectionsList/${inspId}`).set(oldInspection);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Test result
    const nested = yield db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspection = yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspectionList = yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).once('value');
    const completedInspection = yield db.ref(`/completedInspections/${inspId}`).once('value');
    const completedInspectionList = yield db.ref(`/completedInspectionsList/${inspId}`).once('value');

    // Assertions
    const expected = Object.assign({}, newInspection);
    delete expected.property;
    expect(propertyInspection.val()).to.deep.equal(expected, 'updated /propertyInspections proxy');
    expect(propertyInspectionList.val()).to.deep.equal(expected, 'updated /propertyInspectionsList proxy');
    expect(nested.val()).to.deep.equal(expected, 'updated /property nested inspection proxy');

    const expectedCompleted = Object.assign({}, newInspection);
    delete expected.property;
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    expect(completedInspection.val()).to.deep.equal(expectedCompleted, 'updated /completedInspections proxy');
    expect(completedInspectionList.val()).to.deep.equal(expectedCompleted, 'updated /completedInspectionsList proxy');
  }));

  it('should remove a completedInspection that becomes incomplete', () => co(function *() {
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
      inspectionCompleted: false
    };
    const oldInspection = Object.assign({}, newInspection, { inspectionCompleted: true, updatedLastDate: now - 1000 })

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(newInspection);
    yield db.ref(`/properties/${propertyId}`).set({ inspections: { [inspId]: oldInspection } });
    yield db.ref(`/completedInspections/${inspId}`).set(oldInspection);
    yield db.ref(`/completedInspectionsList/${inspId}`).set(oldInspection);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Test results
    const actual = yield db.ref(`/completedInspections/${inspId}`).once('value');
    const actualList = yield db.ref(`/completedInspectionsList/${inspId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false, 'removed /completedInspections proxy');
    expect(actualList.exists()).to.equal(false, 'removed /completedInspectionsList proxy');
  }));

  it('should update property with any meta data from its\' completed inspections', () => co(function *() {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = (Date.now() / 1000);
    const oldest = (Date.now() / 1000) - 100000;
    const inspectionOne = mocking.createInspection({ property: propertyId, inspectionCompleted: true, creationDate: newest, score: 65 });
    const inspectionTwo = mocking.createInspection({ property: propertyId, inspectionCompleted: true, creationDate: oldest, score: 25 });
    const expected = {
      numOfInspections: 2,
      lastInspectionScore: inspectionOne.score,
      lastInspectionDate: inspectionOne.creationDate
    };

    // Setup database
    yield db.ref(`/inspections/${insp1Id}`).set(inspectionOne); // Add inspection #1
    yield db.ref(`/inspections/${insp2Id}`).set(inspectionTwo); // Add inspection #2
    yield db.ref(`/properties/${propertyId}`).set({
      inspections: { [insp1Id]: inspectionOne, [insp2Id]: inspectionTwo } // Add nested inspections
    });

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Test result
    const propertySnap = yield db.ref(`/properties/${propertyId}`).once('value');
    const actual = propertySnap.val();

    // Assertions
    expect(actual.numOfInspections).to.equal(
      expected.numOfInspections,
      'updated property\'s `numOfInspections`'
    );
    expect(actual.lastInspectionScore).to.equal(
      expected.lastInspectionScore,
      'updated property\'s `lastInspectionScore`'
    );
    expect(actual.lastInspectionDate).to.equal(
      expected.lastInspectionDate,
      'updated property\'s `lastInspectionDate`'
    );
  }));

  it('should not create proxy records for inspections belonging to a deleted property', () => co(function *() {
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
      inspectionCompleted: true
    };

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(inspectionData);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Test results
    const actual = yield Promise.all([
      db.ref(`/completedInspections/${inspId}`).once('value'),
      db.ref(`/completedInspectionsList/${inspId}`).once('value'),
      db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value'),
      db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).once('value')
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([false, false, false, false]);
  }));

  it('should not update a deleted property\'s meta data when its\' inspections still exist', () => co(function *() {
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
      inspectionCompleted: true
    };

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(inspectionData);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Test result
    const actual = yield Promise.all([
      db.ref(`/properties/${propertyId}/numOfInspections`).once('value'),
      db.ref(`/properties/${propertyId}/lastInspectionScore`).once('value'),
      db.ref(`/properties/${propertyId}/lastInspectionDate`).once('value')
    ]);

    // Assertions
    expect(actual.map(attr => attr.val())).to.deep.equal([null, null, null]);
  }));
});
