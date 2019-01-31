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
const { cleanDb } = require('../../test-helpers/firebase');
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
  afterEach(() => cleanDb(db));

  it('should update an existing template\'s data in /propertyTemplates', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const expected = { description: `desc${tmplId}`, name: `new${tmplId}` };
    const propertyData = { templates: { [tmplId]: true } };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(expected);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set({ [propertyId]: { [tmplId]: { name: 'old' } } }); // must exist

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should remove /propertyTemplates no longer associated with property', () => co(function *() {
    const oldTmplId = uuid();
    const currTmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `remove${oldTmplId}`, description: `remove${oldTmplId}` };
    const propertyData = { templates: { [currTmplId]: true } }; // not associated w/ oldTmplId

    // Setup database
    yield db.ref(`/templates/${oldTmplId}`).set(templateData);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set({
      [propertyId]: {
        [oldTmplId]: templateData, // must exist
        [currTmplId]: { name: 'current' }
      }
    });

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const removedtmpl = yield db.ref(`/propertyTemplates/${propertyId}/${oldTmplId}`).once('value');
    const currentTmpl = yield db.ref(`/propertyTemplates/${propertyId}/${currTmplId}`).once('value');

    // Assertions
    expect(removedtmpl.exists()).to.equal(false, 'removed disassociated propertyTemplate');
    expect(currentTmpl.exists()).to.equal(true, 'kept associated propertyTemplate');
  }));

  it('should add missing records in /templatesList', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const expected = { description: `desc${tmplId}`, name: `new${tmplId}` };
    const propertyData = { templates: { [tmplId]: true } };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(expected);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should update existing records in /templatesList', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const expected = { description: `desc${tmplId}`, name: `new${tmplId}` };
    const propertyData = { templates: { [tmplId]: true } };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(expected); // up to date
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref(`/templatesList/${tmplId}`).set({ name: 'outdated', description: 'outdated' });

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should remove orphaned records in /templatesList', () => co(function *() {
    const tmplId = uuid();

    // Setup database
    yield db.ref(`/templatesList/${tmplId}`).set({ name: 'orphan', description: 'orphan' });

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  }));
});
