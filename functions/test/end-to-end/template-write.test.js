const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Templates Write', () => {
  afterEach(() => cleanDb(db));

  it('should create property proxies when a template is added', () => co(function *() {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const categoryId = uuid();
    const afterData = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: { description: `desc${tmpl3Id}`, name: `name${tmpl3Id}`, category: categoryId }
    };

    // Setup database
    yield db.ref(`/properties/${property1Id}`).set({ name: `test${property1Id}`, templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } }); // Add property 1 /w templates
    yield db.ref(`/properties/${property2Id}`).set({ name: `test${property2Id}`, templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } }); // Add property 2 /w templates
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    const tests = [tmpl1Id, tmpl2Id, tmpl3Id];

    while(tests.length) {
      const tmplId = tests.shift();
      const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value');
      yield db.ref(`/templates/${tmplId}`).set(afterData[tmplId]); // Add template
      const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value');

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.templateWrite);
      yield wrapped(changeSnap, { params: { objectId: tmplId } });

      // Test result
      const paths = [
        `/propertyTemplates/${property1Id}/${tmplId}`,
        `/propertyTemplatesList/${property1Id}/${tmplId}`,
        `/propertyTemplates/${property2Id}/${tmplId}`,
        `/propertyTemplatesList/${property2Id}/${tmplId}`
      ];
      const results = yield Promise.all(paths.map(path => db.ref(path).once('value')));

      // Assertions
      results.forEach((snapshot, i) => {
        const actual = snapshot.val();
        const expected = afterData[tmplId];
        expect(actual).to.deep.equal(expected, `proxy record ${recordPaths[i]} created at test ${i}`);
      });
    }
  }));

  it('should remove all a deleted template\'s property proxies', () => co(function *() {
    const tmplId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const templateData = { name: `test${tmplId}`};

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(templateData);
    yield db.ref(`/propertyTemplates/${property1Id}/${tmplId}`).set(templateData); // Property #1
    yield db.ref(`/propertyTemplatesList/${property1Id}/${tmplId}`).set(templateData); // Property #1
    yield db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).set(templateData); // Property #2
    yield db.ref(`/propertyTemplatesList/${property2Id}/${tmplId}`).set(templateData); // Property #2
    yield db.ref(`/properties/${property1Id}`).set({ name: `test${property1Id}`, templates: { [tmplId]: true } }); // Add property 1 /w template
    yield db.ref(`/properties/${property2Id}`).set({ name: `test${property2Id}`, templates: { [tmplId]: true } }); // Add property 2 /w template
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
      db.ref(`/propertyTemplatesList/${property1Id}/${tmplId}`).once('value'),
      db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).once('value'),
      db.ref(`/propertyTemplatesList/${property2Id}/${tmplId}`).once('value')
    ]);

    // Assertions
    expect(actual.map((ds) => ds.val())).to.deep.equal([null, null, null, null]);
  }));

  it('should update a template\'s property proxies with newest data', () => co(function *() {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const categoryId = uuid();
    const beforeData = {
      [tmpl1Id]: { name: 'old' },
      [tmpl2Id]: { description: 'old', name: 'old' },
      [tmpl3Id]: { description: 'old', name: 'old', category: 'old' }
    };
    const afterData = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: { description: `desc${tmpl3Id}`, name: `name${tmpl3Id}`, category: categoryId }
    };

    // Setup database
    yield db.ref(`/properties/${property1Id}`).set({ name: `test${property1Id}`, templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } }); // Add property 1 /w templates
    yield db.ref(`/properties/${property2Id}`).set({ name: `test${property2Id}`, templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } }); // Add property 2 /w templates
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    const tests = [tmpl1Id, tmpl2Id, tmpl3Id];

    while(tests.length) {
      const tmplId = tests.shift();
      yield db.ref(`/templates/${tmplId}`).set(beforeData[tmplId]);
      yield db.ref(`/propertyTemplates/${property1Id}/${tmplId}`).set(beforeData[tmplId]); // Property #1
      yield db.ref(`/propertyTemplatesList/${property1Id}/${tmplId}`).set(beforeData[tmplId]); // Property #1
      yield db.ref(`/propertyTemplates/${property2Id}/${tmplId}`).set(beforeData[tmplId]); // Property #2
      yield db.ref(`/propertyTemplatesList/${property2Id}/${tmplId}`).set(beforeData[tmplId]); // Property #2
      const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value'); // Get before template
      yield db.ref(`/templates/${tmplId}`).update(afterData[tmplId]); // update template
      const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value'); // Get after template

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.templateWrite);
      yield wrapped(changeSnap, { params: { objectId: tmplId } });

      // Test result
      const paths = [
        `/propertyTemplates/${property1Id}/${tmplId}`,
        `/propertyTemplatesList/${property1Id}/${tmplId}`,
        `/propertyTemplates/${property2Id}/${tmplId}`,
        `/propertyTemplatesList/${property2Id}/${tmplId}`
      ];
      const results = yield Promise.all(paths.map(path => db.ref(path).once('value')));

      // Assertions
      results.forEach((snapshot, i) => {
        const actual = snapshot.val();
        const expected = afterData[tmplId];
        expect(actual).to.deep.equal(expected, `proxy record ${recordPaths[i]} created at test ${i}`);
      });
    }
  }));

  it('should add proxy record to /templatesList after template addition', () => co(function *() {
    const tmplId = uuid();
    const categoryId = uuid();
    const expected = { name: `test${tmplId}`, description: `desc${tmplId}`, category: categoryId };

    // Setup database
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value');
    yield db.ref(`/templates/${tmplId}`).set(expected); // add template
    const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    yield wrapped(changeSnap, { params: { objectId: tmplId } });

    // Test result
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should update proxy record in /templatesList after template update', () => co(function *() {
    const tmplId = uuid();
    const category1Id = uuid();
    const category2Id = uuid()
    const beforeData = { name: `test${tmplId}`, description: `desc${tmplId}`, category: category1Id };
    const expected = { name: `test${tmplId}--rev2`, description: `desc${tmplId}--rev2`, category: category2Id };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(beforeData); // add template
    yield db.ref(`/templateCategories/${category1Id}`).set({ name: `name${category1Id}` }); // sanity check
    yield db.ref(`/templateCategories/${category2Id}`).set({ name: `name${category2Id}` }); // sanity check
    yield db.ref(`/templatesList/${tmplId}`).set(beforeData); // add proxy template
    const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value');
    yield db.ref(`/templates/${tmplId}`).set(expected); // update template
    const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    yield wrapped(changeSnap, { params: { objectId: tmplId } });

    // Test result
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should remove proxy record from /templatesList after template deletion', () => co(function *() {
    const tmplId = uuid();
    const categoryId = uuid();
    const beforeData = { name: `test${tmplId}`, description: `desc${tmplId}`, category: categoryId };

    // Setup database
    yield db.ref(`/templates/${tmplId}`).set(beforeData); // add template
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    yield db.ref(`/templatesList/${tmplId}`).set(beforeData); // add proxy templateList
    const beforeSnap = yield db.ref(`/templates/${tmplId}`).once('value');
    yield db.ref(`/templates/${tmplId}`).remove(); // delete template
    const afterSnap = yield db.ref(`/templates/${tmplId}`).once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    yield wrapped(changeSnap, { params: { objectId: tmplId } });

    // Test result
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  }));
});
