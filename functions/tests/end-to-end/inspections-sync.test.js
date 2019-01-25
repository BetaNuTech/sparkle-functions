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

describe('Inspections Sync', () => {
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
    yield db.ref(`/completedInspections/${inspId}`).set(oldInspection);

    // execute
    const wrapped = test.wrap(cloudFunctions.inspectionsSync);
    yield wrapped();

    // Lookup updated records
    const nested = yield db.ref(`/properties/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspection = yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value');
    const completedInspection = yield db.ref(`/completedInspections/${inspId}`).once('value');

    // Compare to expected
    const expected = Object.assign({}, newInspection);
    delete expected.property;
    expect(expected).to.deep.equal(propertyInspection.val(), 'updated nested /propertyInspections');
    expect(expected).to.deep.equal(nested.val(), 'updated /property nested inspection');

    const expectedCompleted = Object.assign({}, newInspection);
    delete expected.property;
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    expect(expectedCompleted).to.deep.equal(completedInspection.val(), 'updated nested /completedInspections');
  }));
});
