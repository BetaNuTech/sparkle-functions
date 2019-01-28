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
admin.initializeApp();
const db = admin.database();

describe('Inspections Updated Last Date Write', () => {
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

  it('should update all an inspections\' outdated proxy records', () => co(function *() {
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
    yield db.ref(`/inspections/${inspId}`).set(Object.assign({}, inspectionData, { updatedLastDate: now - 1000 })); // Add inspection with old updated date
    const beforeSnap = yield db.ref(`/inspections/${inspId}/updatedLastDate`).once('value');
    yield db.ref(`/inspections/${inspId}/updatedLastDate`).set(now);
    const afterSnap = yield db.ref(`/inspections/${inspId}/updatedLastDate`).once('value');

    // execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Lookup updated records
    const nested = yield db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspection = yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value');
    const completedInspection = yield db.ref(`/completedInspections/${inspId}`).once('value');

    // Compare to expected
    const expected = Object.assign({}, inspectionData);
    delete expected.property;
    expect(expected).to.deep.equal(propertyInspection.val(), 'updated nested /propertyInspections');
    expect(expected).to.deep.equal(nested.val(), 'updated /property nested inspection');

    const expectedCompleted = Object.assign({}, inspectionData);
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    expect(expectedCompleted).to.deep.equal(completedInspection.val(), 'updated nested /completedInspections');
  }));
});
