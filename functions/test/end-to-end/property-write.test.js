const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Property Write', () => {
  afterEach(() => cleanDb(db));

  it('should remove all a deleted property\'s template proxies', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `test${tmplId}`};

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId]: true } }); // Add property with a template    yield db.ref('/templates').set(expected);
    yield db.ref(`/templates/${tmplId}`).set(templateData); // Add template
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).set(templateData); // Add propertyTemplates
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId}`).set(templateData); // Add propertyTemplatesList

    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get before property
    yield db.ref(`/properties/${propertyId}`).remove(); // Remove property
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get after templates

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    yield wrapped(changeSnap, { params: { objectId: propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false, 'removed /propertyTemplates proxy');
    expect(actualList.exists()).to.equal(false, 'removed /propertyTemplatesList proxy');
  }));

  it('should remove a template\'s property proxies when a template is disassociated from property', () => co(function *() {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const propertyId = uuid();
    const expected = { [tmplId1]: { name: `name${tmplId1}`, description: `desc${tmplId1}` } }; // only has template 1

    // Setup database
    // Add property with templates
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId1]: true, [tmplId2]: true } });
    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get before templates
    yield db.ref(`/properties/${propertyId}/templates/${tmplId2}`).remove(); // Remove 2nd template
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get after templates
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId1}`).set(expected[tmplId1]);
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`).set(expected[tmplId1]);
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId2}`).set({ name: `test${tmplId2}`});
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId2}`).set({ name: `test${tmplId2}`});

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    yield wrapped(changeSnap, { params: { objectId: propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected, 'has /propertyTemplates proxy');
    expect(actualList.val()).to.deep.equal(expected, 'has /propertyTemplatesList proxy');
  }));

  it('should upsert template property proxies when a property has template relationships', () => co(function *() {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const categoryId = uuid();
    const propertyId = uuid();
    const expected = {
      [tmplId1]: { name: `name${tmplId1}`, description: `desc${tmplId1}`, category: categoryId },
      [tmplId2]: { name: `name${tmplId2}`, description: `desc${tmplId2}`, category: categoryId }
    };

    // Setup database
    yield db.ref('/templates').set(expected); // Add property's templates
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    yield db.ref(`/properties/${propertyId}`).set({ name: 'test', templates: { [tmplId1]: true } }); // Only has 1st template
    yield db.ref(`/propertyTemplates/${propertyId}/${tmplId1}`).set(expected[tmplId1]); // Add 1st template proxy record
    yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`).set(expected[tmplId1]); // Add 1st template list proxy record
    const propertyBeforeSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get before templates
    yield db.ref(`/properties/${propertyId}/templates/${tmplId2}`).set(true); // Associate 2nd template w/ property
    const propertyAfterSnap = yield db.ref(`/properties/${propertyId}`).once('value'); // Get after templates

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    yield wrapped(changeSnap, { params: { objectId: propertyId } });

    // Test result
    const actual = yield db.ref(`/propertyTemplates/${propertyId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected, 'has /propertyTemplates proxy');
    expect(actualList.val()).to.deep.equal(expected, 'has /propertyTemplatesList proxy');
  }));
});
