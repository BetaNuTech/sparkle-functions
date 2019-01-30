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

describe('Template Category Delete', () => {
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

  it('should disassociate all templates belonging to the template category', () => co(function *() {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = { name: `test${tmpl1Id}`, description: `desc${tmpl1Id}`, category: categoryId }; // related
    const tmpl2Data = { name: `test${tmpl2Id}`, description: `desc${tmpl2Id}`, category: categoryId }; // related
    const tmpl3Data = { name: `test${tmpl3Id}`, description: `desc${tmpl3Id}`, category: uuid() }; // unrelated

    // Setup database
    yield db.ref(`/templates/${tmpl1Id}`).set(tmpl1Data); // add template #1
    yield db.ref(`/templates/${tmpl2Id}`).set(tmpl2Data); // add template #2
    yield db.ref(`/templates/${tmpl3Id}`).set(tmpl3Data); // add template #3
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `category${categoryId}` }); // add category
    const deleteSnap = yield db.ref(`/templateCategories/${categoryId}`).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    yield wrapped(deleteSnap, { params: { objectId: categoryId } });

    // Test result
    const actualTmpl1Cat = yield db.ref(`/templates/${tmpl1Id}/category`).once('value');
    const actualTmpl2Cat = yield db.ref(`/templates/${tmpl2Id}/category`).once('value');
    const actualTmpl3Cat = yield db.ref(`/templates/${tmpl3Id}/category`).once('value');

    // Assertions
    expect(actualTmpl1Cat.val()).to.equal(null, 'removed template 1 relationship');
    expect(actualTmpl2Cat.val()).to.equal(null, 'removed template 2 relationship');
    expect(actualTmpl3Cat.val()).to.equal(tmpl3Data.category, 'template 3 relationship unchanged');
  }));

  it('should disassociate all /templatesList belonging to the template category', () => co(function *() {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = { name: `test${tmpl1Id}`, description: `desc${tmpl1Id}`, category: categoryId }; // related
    const tmpl2Data = { name: `test${tmpl2Id}`, description: `desc${tmpl2Id}`, category: categoryId }; // related
    const tmpl3Data = { name: `test${tmpl3Id}`, description: `desc${tmpl3Id}`, category: uuid() }; // unrelated

    // Setup database
    yield db.ref(`/templates/${tmpl1Id}`).set(tmpl1Data); // add template #1
    yield db.ref(`/templatesList/${tmpl1Id}`).set(tmpl1Data); // add template #1 proxy
    yield db.ref(`/templates/${tmpl2Id}`).set(tmpl2Data); // add template #2
    yield db.ref(`/templatesList/${tmpl2Id}`).set(tmpl2Data); // add template #2 proxy
    yield db.ref(`/templates/${tmpl3Id}`).set(tmpl3Data); // add template #3
    yield db.ref(`/templatesList/${tmpl3Id}`).set(tmpl3Data); // add template #2 proxy
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `category${categoryId}` }); // add category
    const deleteSnap = yield db.ref(`/templateCategories/${categoryId}`).once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    yield wrapped(deleteSnap, { params: { objectId: categoryId } });

    // Test result
    const actualTmpl1Cat = yield db.ref(`/templatesList/${tmpl1Id}/category`).once('value');
    const actualTmpl2Cat = yield db.ref(`/templatesList/${tmpl2Id}/category`).once('value');
    const actualTmpl3Cat = yield db.ref(`/templatesList/${tmpl3Id}/category`).once('value');

    // Assertions
    expect(actualTmpl1Cat.val()).to.equal(null, 'removed template 1 proxy relationship');
    expect(actualTmpl2Cat.val()).to.equal(null, 'removed template 2 proxy relationship');
    expect(actualTmpl3Cat.val()).to.equal(tmpl3Data.category, 'template 3 proxy relationship unchanged');
  }));
});
