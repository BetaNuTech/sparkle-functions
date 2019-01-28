const co = require('co');
const test = require('firebase-functions-test')({
  databaseURL: 'https://test-sapphire-inspections-8a9e3.firebaseio.com',
  storageBucket: 'test-sapphire-inspections-8a9e3.appspot.com',
  projectId: 'test-sapphire-inspections-8a9e3',
}, '../auth.json');
const sinon = require('sinon');
const admin = require('firebase-admin');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
admin.initializeApp();
const db = admin.database();

describe('Inspections Migration Date Sync', () => {
  var cloudFunctions, oldDatabase;

  before(() => {
    // Stub admin.initializeApp to avoid live database access
    if (!admin.initializeApp.isSinonProxy) {
      adminInitStub = sinon.stub(admin, 'initializeApp').returns({ database: () => db });
      oldDatabase = admin.database;
      Object.defineProperty(admin, 'database', { writable: true, value: () => db });
    }
    cloudFunctions = require('../../index');
  });
  after(() => admin.database = oldDatabase);

  it('should migrate all an inspections\' outdated proxy records', () => co(function *() {
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
      migrationDate: now
    };

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(Object.assign({}, inspectionData, { migrationDate: now - 1000 })); // Add inspection with old migration
    const beforeSnap = yield db.ref(`/inspections/${inspId}/migrationDate`).once('value');
    yield db.ref(`/inspections/${inspId}/migrationDate`).set(now);
    const afterSnap = yield db.ref(`/inspections/${inspId}/migrationDate`).once('value');

    // execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionMigrationDateWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Lookup updated records
    const nested = yield db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspection = yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value');
    const completedInspection = yield db.ref(`/completedInspections/${inspId}`).once('value');

    // Compare to expected
    const expected = Object.assign({}, inspectionData);
    delete expected.property;
    delete expected.migrationDate;
    expect(expected).to.deep.equal(propertyInspection.val(), 'updated nested /propertyInspections');
    expect(expected).to.deep.equal(nested.val(), 'updated /property nested inspection');

    const expectedCompleted = Object.assign({}, inspectionData);
    delete expectedCompleted.migrationDate;
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    expect(expectedCompleted).to.deep.equal(completedInspection.val(), 'updated nested /completedInspections');
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
    const beforeSnap = yield db.ref(`/inspections/${insp1Id}/updatedLastDate`).once('value');
    yield db.ref(`/inspections/${insp1Id}/updatedLastDate`).set(newest);
    const afterSnap = yield db.ref(`/inspections/${insp1Id}/updatedLastDate`).once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionMigrationDateWrite);
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
