const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Templates Sync', () => {
  afterEach(() => cleanDb(db));

  it('should create new proxy template records', () => co(function *() {
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
    const actual = yield Promise.all([
      db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmplId}`).once('value')
    ]);

    // Assertions
    expect(actual.map(proxy => proxy.exists())).to.deep.equal([true, true]);
  }));

  it('should update all existing proxy template\'s data', () => co(function *() {
    const tmplId = uuid();
    const propertyId = uuid();
    const expected = { description: `desc${tmplId}`, name: `new${tmplId}` };
    const propertyData = { templates: { [tmplId]: true } };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(expected);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set({ [propertyId]: { [tmplId]: { name: 'old' } } }); // must exist
    yield db.ref('/propertyTemplatesList').set({ [propertyId]: { [tmplId]: { name: 'old' } } }); // must exist

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/propertyTemplates/${propertyId}/${tmplId}`).once('value');
    const actualList = yield db.ref(`/propertyTemplatesList/${propertyId}/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected, 'updated /propertyTemplates proxy');
    expect(actualList.val()).to.deep.equal(expected, 'updated /propertyTemplatesList proxy');
  }));

  it('should remove a property\'s template proxies no longer associated with property', () => co(function *() {
    const oldTmplId = uuid();
    const currTmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `remove${oldTmplId}`, description: `remove${oldTmplId}` };
    const propertyData = { templates: { [currTmplId]: true } }; // not associated w/ oldTmplId
    const proxyTmplData = {
      [propertyId]: {
        [oldTmplId]: templateData, // must exist
        [currTmplId]: { name: 'current' }
      }
    };

    // Setup database
    yield db.ref(`/templates/${oldTmplId}`).set(templateData);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set(proxyTmplData);
    yield db.ref('/propertyTemplatesList').set(proxyTmplData);

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const removedtmpl = yield db.ref(`/propertyTemplates/${propertyId}/${oldTmplId}`).once('value');
    const removedtmplList = yield db.ref(`/propertyTemplatesList/${propertyId}/${oldTmplId}`).once('value');
    const currentTmpl = yield db.ref(`/propertyTemplates/${propertyId}/${currTmplId}`).once('value');
    const currentTmplList = yield db.ref(`/propertyTemplatesList/${propertyId}/${currTmplId}`).once('value');

    // Assertions
    expect(removedtmpl.exists()).to.equal(false, 'removed disassociated /propertyTemplates');
    expect(removedtmplList.exists()).to.equal(false, 'removed disassociated /propertyTemplatesList');
    expect(currentTmpl.exists()).to.equal(true, 'kept associated /propertyTemplates');
    expect(currentTmplList.exists()).to.equal(true, 'kept associated /propertyTemplatesList');
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
