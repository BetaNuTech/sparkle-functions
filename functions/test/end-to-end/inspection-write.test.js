const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Inspection Write', () => {
  afterEach(() => cleanDb(db));

  it('should remove proxy records of a deleted inspection', () => co(function *() {
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
    yield db.ref(`/inspections/${inspId}`).set(inspectionData); // Add inspection
    yield db.ref(`/properties/${propertyId}`).set({ inspections: { [inspId]: inspectionData } }); // Add nested inspection
    yield db.ref(`/completedInspections/${inspId}`).set(inspectionData); // Add completedInspection
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).set(inspectionData); // Add propertyInspection
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).remove(); // Remove inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Lookup updated records
    const actual = yield Promise.all([
      db.ref(`/completedInspections/${inspId}`).once('value'),
      db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value'),
      db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value')
    ]);
    expect(actual.map((ds) => ds.exists())).to.deep.equal([false, false, false]);
  }));

  it('should update inspections\' proxy records with new data', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: true
    };

    const afterData = Object.assign({}, beforeData, {
      templateName: `name${inspId}--rev2`,
      inspectorName: 'testor--rev2',
      score: 8,
      deficienciesExist: true,
      updatedLastDate: now,
    });

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    yield db.ref(`/properties/${propertyId}`).set({ inspections: { [inspId]: beforeData } }); // Add nested inspection
    yield db.ref(`/completedInspections/${inspId}`).set(beforeData); // Add completedInspection
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).set(beforeData); // Add propertyInspection
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // Remove inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Lookup updated records
    const nested = yield db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspection = yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value');
    const completedInspection = yield db.ref(`/completedInspections/${inspId}`).once('value');

    // Compare to expected
    const expected = Object.assign({}, afterData);
    delete expected.property;
    expect(expected).to.deep.equal(propertyInspection.val(), 'updated nested /propertyInspections');
    expect(expected).to.deep.equal(nested.val(), 'updated /property nested inspection');

    const expectedCompleted = Object.assign({}, afterData);
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    expect(expectedCompleted).to.deep.equal(completedInspection.val(), 'updated nested /completedInspections');
  }));

  it('should update completedInspections when inspection becomes', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 9,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: false
    };

    const afterData = Object.assign({}, beforeData, {
      itemsCompleted: 10,
      updatedLastDate: now,
      inspectionCompleted: true
    });

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // Update inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Lookup updated records
    const actual = yield db.ref(`/completedInspections/${inspId}`).once('value');

    const expected = Object.assign({}, afterData);
    delete expected.itemsCompleted;
    delete expected.totalItems;
    expect(expected).to.deep.equal(actual.val(), 'updated /completedInspections');
  }));

  it('should ensure an incomplete inspection does not exist in completedInspections', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: false
    };

    const afterData = Object.assign({}, beforeData, { updatedLastDate: now });

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // Update inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Lookup updated records
    const actual = yield db.ref(`/completedInspections/${inspId}`).once('value');

    // Compare to expected
    expect(false).to.equal(actual.exists(), '/completedInspections proxy does not exist');
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
    const snap = yield db.ref(`/inspections/${insp1Id}`).once('value'); // Create snapshot

    // Execute
    const changeSnap = test.makeChange(snap, snap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: insp1Id } });

    // Lookup updated records
    const propertySnap = yield db.ref(`/properties/${propertyId}`).once('value');
    const actual = propertySnap.val();

    // Assertions
    expect(expected.numOfInspections).to.equal(
      actual.numOfInspections,
      'updated property\'s `numOfInspections`'
    );
    expect(expected.lastInspectionScore).to.equal(
      actual.lastInspectionScore,
      'updated property\'s `lastInspectionScore`'
    );
    expect(expected.lastInspectionDate).to.equal(
      actual.lastInspectionDate,
      'updated property\'s `lastInspectionDate`'
    );
  }));
});
