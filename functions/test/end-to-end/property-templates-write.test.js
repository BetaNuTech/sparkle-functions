const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Property Templates Write', () => {
  afterEach(() => cleanDb(db));

  it('should remove all property template proxies when a property removes all templates', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId]: true } }); // Add property with a template
    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get before templates
    yield db.ref(`/properties/${propertyId}/templates`).remove(); // Remove templates
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get after templates
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).set({ name: `test${tmplId}`});
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId}`).set({ name: `test${tmplId}`});

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    yield wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false, 'removed /propertyTemplates proxy');
    expect(actualList.exists()).to.equal(false, 'removed /propertyTemplatesList proxy');
  }));

  it('should remove a template\'s property proxies when it is disassociated from a property', () => co(function *() {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const propertyId = uuid();
    const expected = { [tmplId1]: { name: `name${tmplId1}`, description: `desc${tmplId1}` } }; // only has template 1

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId1]: true, [tmplId2]: true } });
    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get before templates
    yield db.ref(`/properties/${propertyId}/templates/${tmplId2}`).remove(); // Remove 2nd template
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get after templates
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId1}`).set(expected[tmplId1]);
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`).set(expected[tmplId1]);
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId2}`).set({ name: `test${tmplId2}`});
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId2}`).set({ name: `test${tmplId2}`});

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    yield wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected, 'removed single /propertyTemplates proxy');
    expect(actualList.val()).to.deep.equal(expected, 'removed single /propertyTemplatesList proxy');
  }));

  it('should update property template proxies when a template is added to a property', () => co(function *() {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const categoryId = uuid();
    const propertyId = uuid();
    const expected = {
      [tmplId1]: { name: `name${tmplId1}`, description: `desc${tmplId1}`, category: categoryId },
      [tmplId2]: { name: `name${tmplId2}`, description: `desc${tmplId2}`, category: categoryId }
    };

    // Setup database
    yield db.ref('/templates').set(expected); // Add template
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId1]: true } }); // Only has 1st template
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get before templates
    yield db.ref(`/properties/${propertyId}/templates/${tmplId2}`).set(true); // Associate 2nd template w/ property
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}/templates`).once('value'); // Get after templates
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId1}`).set(expected[tmplId1]); // Add 1st template proxy record
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`).set(expected[tmplId1]); // Add 1st template list proxy record

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    yield wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected, 'has /propertyTemplates proxy');
    expect(actualList.val()).to.deep.equal(expected, 'has /propertyTemplatesList proxy');
  }));
});
