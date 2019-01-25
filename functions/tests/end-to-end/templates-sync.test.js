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

describe('Templates Sync', () => {
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

  it('should update an existing template\'s data in /propertyTemplates', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const expected = { description: `desc${tmplId}`, name: `new${tmplId}` };
    const propertyData = { templates: { [tmplId]: true } };

    // Setup database records for test
    yield db.ref(`/templates/${tmplId}`).set(expected);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set({ [propertyId]: { [tmplId]: { name: 'old' } } }); // must exist

    const wrapped = test.wrap(cloudFunctions.templatesSync);
    yield wrapped();
    const actual = yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).once('value');
    expect(expected).to.deep.equal(actual.val());
  }));

  it('should remove /propertyTemplates no longer associated with property', () => co(function *() {
    const oldTmplId = uuid();
    const currTmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `remove${oldTmplId}` };
    const propertyData = { templates: { [currTmplId]: true } }; // not associated w/ oldTmplId

    // Setup database records for test
    yield db.ref(`/templates/${oldTmplId}`).set(templateData);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set({
      [propertyId]: {
        [oldTmplId]: templateData, // must exist
        [currTmplId]: { name: 'current' }
      }
    });

    const wrapped = test.wrap(cloudFunctions.templatesSync);
    yield wrapped();

    const removedtmpl = yield db.ref(`/propertyTemplates/${propertyId}/${oldTmplId}`).once('value');
    expect(removedtmpl.exists()).to.equal(false, 'removed disassociated propertyTemplate');
    const currentTmpl = yield db.ref(`/propertyTemplates/${propertyId}/${currTmplId}`).once('value');
    expect(currentTmpl.exists()).to.equal(true, 'kept associated propertyTemplate');
  }));
});
