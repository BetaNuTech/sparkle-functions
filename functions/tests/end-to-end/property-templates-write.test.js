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

describe('Property Templates Write', () => {
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

  it('should remove all /propertyTemplates when a property removes all templates', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const inspectionData = { description: `desc${tmplId}`, name: `new${tmplId}` };

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId]: true } }); // Add property with templates
    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get before templates
    yield db.ref(`/properties/${propertyId}/templates`).remove(); // Remove templates
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get after templates
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).set({ name: `test${tmplId}`});

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    yield wrapped(changeSnap, { params: { objectId: propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    expect(actual.exists()).to.equal(false);
  }));
});
