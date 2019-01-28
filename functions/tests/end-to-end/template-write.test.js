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

describe('Templates Write', () => {
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

  it('should remove all `propertyTemplates` belonging to a deleted template', () => co(function *() {
    const tmplId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const templateData = { name: `test${tmplId}`};

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(templateData);
    yield db.ref(`/propertyTemplates/${property1Id}/${tmplId}`).set(templateData);
    yield db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).set(templateData);
    yield db.ref(`/properties/${property1Id}`).set({ name: `test${property1Id}`, templates: { [tmplId]: true } }); // Add property 1 with template
    yield db.ref(`/properties/${property2Id}`).set({ name: `test${property2Id}`, templates: { [tmplId]: true } }); // Add property 2 with template
    const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value'); // Get before template
    yield db.ref(`/templates/${tmplId}`).remove(); // Remove template
    const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value'); // Get after template

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    yield wrapped(changeSnap, { params: { objectId: tmplId } });

    // Test result
    const actual = yield Promise.all([
      db.ref(`/propertyTemplates/${property1Id}/${tmplId}`).once('value'),
      db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).once('value')
    ]);

    expect(actual.map((ds) => ds.val())).to.deep.equal([null, null]);
  }));

  it('should update all `propertyTemplates` belonging to an updated template', () => co(function *() {
    const tmplId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const beforeData = { name: `test${tmplId}--rev1`, description: `desc${tmplId}--rev1` };
    const expected = { name: `test${tmplId}--rev2`, description: `desc${tmplId}--rev2` };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(beforeData);
    yield db.ref(`/propertyTemplates/${property1Id}/${tmplId}`).set(beforeData);
    yield db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).set(beforeData);
    yield db.ref(`/properties/${property1Id}`).set({ name: `test${property1Id}`, templates: { [tmplId]: true } }); // Add property 1 with template
    yield db.ref(`/properties/${property2Id}`).set({ name: `test${property2Id}`, templates: { [tmplId]: true } }); // Add property 2 with template
    const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value'); // Get before template
    yield db.ref(`/templates/${tmplId}`).update(expected); // update template
    const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value'); // Get after template

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    yield wrapped(changeSnap, { params: { objectId: tmplId } });

    // Test result
    const actual = yield Promise.all([
      db.ref(`/propertyTemplates/${property1Id}/${tmplId}`).once('value'),
      db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).once('value')
    ]);

    expect(actual.map((ds) => ds.val())).to.deep.equal([expected, expected]);
  }));
});
