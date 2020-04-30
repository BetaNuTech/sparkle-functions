const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const templatesModel = require('../../../models/templates');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Templates | On Write', () => {
  afterEach(() => cleanDb(db, fs));

  it('should create property proxies when a template is added', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const categoryId = uuid();
    const afterData = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: {
        description: `desc${tmpl3Id}`,
        name: `name${tmpl3Id}`,
        category: categoryId,
      },
    };

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({
      name: `test${property1Id}`,
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    }); // Add property 1 /w templates
    await db.ref(`/properties/${property2Id}`).set({
      name: `test${property2Id}`,
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    }); // Add property 2 /w templates
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    const tests = [tmpl1Id, tmpl2Id, tmpl3Id];

    while (tests.length) {
      const tmplId = tests.shift();
      const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
      await templatesModel.realtimeUpsertRecord(db, tmplId, afterData[tmplId]); // Add template
      const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.templateWrite);
      await wrapped(changeSnap, { params: { templateId: tmplId } });

      // Test result
      const paths = [
        `/propertyTemplatesList/${property1Id}/${tmplId}`,
        `/propertyTemplatesList/${property2Id}/${tmplId}`,
      ];
      const results = await Promise.all(
        paths.map(path => db.ref(path).once('value'))
      );

      // Assertions
      results.forEach((snapshot, i) => {
        const actual = snapshot.val();
        const expected = afterData[tmplId];
        expect(actual).to.deep.equal(
          expected,
          `proxy record ${paths[i]} created at test ${i}`
        );
      });
    }
  });

  it("should remove all a deleted template's property template lists", async () => {
    const tmplId = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const templateData = { name: `test${tmplId}` };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, templateData);
    await db
      .ref(`/propertyTemplatesList/${property1Id}/${tmplId}`)
      .set(templateData); // Property #1
    await db
      .ref(`/propertyTemplatesList/${property2Id}/${tmplId}`)
      .set(templateData); // Property #2
    await db
      .ref(`/properties/${property1Id}`)
      .set({ name: `test${property1Id}`, templates: { [tmplId]: true } }); // Add property 1 /w template
    await db
      .ref(`/properties/${property2Id}`)
      .set({ name: `test${property2Id}`, templates: { [tmplId]: true } }); // Add property 2 /w template
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await db.ref(`/templates/${tmplId}`).remove(); // Remove template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const actual = await Promise.all([
      db.ref(`/propertyTemplatesList/${property1Id}/${tmplId}`).once('value'),
      db.ref(`/propertyTemplatesList/${property2Id}/${tmplId}`).once('value'),
    ]);

    // Assertions
    expect(actual.map(ds => ds.val())).to.deep.equal([null, null]);
  });

  it("should update a template's property template lists with newest data", async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const property1Id = uuid();
    const property2Id = uuid();
    const categoryId = uuid();
    const beforeData = {
      [tmpl1Id]: { name: 'old' },
      [tmpl2Id]: { description: 'old', name: 'old' },
      [tmpl3Id]: { description: 'old', name: 'old', category: 'old' },
    };
    const afterData = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: {
        description: `desc${tmpl3Id}`,
        name: `name${tmpl3Id}`,
        category: categoryId,
      },
    };

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({
      name: `test${property1Id}`,
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    }); // Add property 1 /w templates
    await db.ref(`/properties/${property2Id}`).set({
      name: `test${property2Id}`,
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    }); // Add property 2 /w templates
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    const tests = [tmpl1Id, tmpl2Id, tmpl3Id];

    while (tests.length) {
      const tmplId = tests.shift();
      await db.ref(`/templates/${tmplId}`).set(beforeData[tmplId]);
      await db
        .ref(`/propertyTemplatesList/${property1Id}/${tmplId}`)
        .set(beforeData[tmplId]); // Property #1
      await db
        .ref(`/propertyTemplatesList/${property2Id}/${tmplId}`)
        .set(beforeData[tmplId]); // Property #2

      const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
      await templatesModel.realtimeUpsertRecord(db, tmplId, afterData[tmplId]); // add template
      const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

      // Execute
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.templateWrite);
      await wrapped(changeSnap, { params: { templateId: tmplId } });

      // Test result
      const paths = [
        `/propertyTemplatesList/${property1Id}/${tmplId}`,
        `/propertyTemplatesList/${property2Id}/${tmplId}`,
      ];
      const results = await Promise.all(
        paths.map(path => db.ref(path).once('value'))
      );

      // Assertions
      results.forEach((snapshot, i) => {
        const actual = snapshot.val();
        const expected = afterData[tmplId];
        expect(actual).to.deep.equal(
          expected,
          `proxy record ${paths[i]} created at test ${i}`
        );
      });
    }
  });

  it('should add a templates list when a template is created', async () => {
    const tmplId = uuid();
    const categoryId = uuid();
    const expected = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
      category: categoryId,
    };

    // Setup database
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await templatesModel.realtimeUpsertRecord(db, tmplId, expected); // add template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const actual = await db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  });

  it('should add a firestore template when a realtime template is created', async () => {
    const tmplId = uuid();
    const categoryId = uuid();
    const expected = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
      category: categoryId,
    };

    // Setup database
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await templatesModel.realtimeUpsertRecord(db, tmplId, expected); // add template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const docSnap = await templatesModel.firestoreFindRecord(fs, tmplId);
    const actual = docSnap.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it("should update a template list when its' source template is updated", async () => {
    const tmplId = uuid();
    const category1Id = uuid();
    const category2Id = uuid();
    const beforeData = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
      category: category1Id,
    };
    const expected = {
      name: `test${tmplId}--rev2`,
      description: `desc${tmplId}--rev2`,
      category: category2Id,
    };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, beforeData); // add template
    await db
      .ref(`/templateCategories/${category1Id}`)
      .set({ name: `name${category1Id}` }); // sanity check
    await db
      .ref(`/templateCategories/${category2Id}`)
      .set({ name: `name${category2Id}` }); // sanity check
    await templatesModel.realtimeUpsertListRecord(db, tmplId, beforeData); // add proxy template
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await templatesModel.realtimeUpsertRecord(db, tmplId, expected); // add template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const actual = await db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  });

  it("should update a firestore template when its' realtime template is updated", async () => {
    const tmplId = uuid();
    const category1Id = uuid();
    const category2Id = uuid();
    const beforeData = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
      category: category1Id,
    };
    const expected = {
      name: `test${tmplId}--rev2`,
      description: `desc${tmplId}--rev2`,
      category: category2Id,
    };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, beforeData); // add template
    await db
      .ref(`/templateCategories/${category1Id}`)
      .set({ name: `name${category1Id}` }); // sanity check
    await db
      .ref(`/templateCategories/${category2Id}`)
      .set({ name: `name${category2Id}` }); // sanity check
    await templatesModel.realtimeUpsertListRecord(db, tmplId, beforeData); // add proxy template
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await templatesModel.realtimeUpsertRecord(db, tmplId, expected); // update template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const docSnap = await templatesModel.firestoreFindRecord(fs, tmplId);
    const actual = docSnap.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it("should remove a template list when its' source template is deleted", async () => {
    const tmplId = uuid();
    const categoryId = uuid();
    const beforeData = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
      category: categoryId,
    };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, beforeData); // add template
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await templatesModel.realtimeUpsertListRecord(db, tmplId, beforeData); // add template list
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await db.ref(`/templates/${tmplId}`).remove(); // delete template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const dataSnap = await db.ref(`/templatesList/${tmplId}`).once('value');
    const actual = dataSnap.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it("should remove a firestore template when its' realtime template is deleted", async () => {
    const tmplId = uuid();
    const categoryId = uuid();
    const beforeData = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
      category: categoryId,
    };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, beforeData); // add realtime template
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await templatesModel.firestoreUpsertRecord(fs, tmplId, beforeData); // add firestore template
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await db.ref(`/templates/${tmplId}`).remove(); // delete template
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const docSnap = await templatesModel.firestoreFindRecord(fs, tmplId);
    const actual = docSnap.exists;

    // Assertions
    expect(actual).to.equal(false);
  });

  it("should remove a templates lists' category when it becomes uncategorized", async () => {
    const tmplId = uuid();
    const categoryId = uuid();
    const expected = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
    };
    const beforeData = Object.assign({}, expected, { category: categoryId });

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, beforeData); // add template /w category
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await templatesModel.realtimeUpsertListRecord(db, tmplId, beforeData); // add template list
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await db.ref(`/templates/${tmplId}/category`).remove(); // Uncategorize (delete source template's category)
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const dataSnap = await db.ref(`/templatesList/${tmplId}`).once('value');
    const actual = dataSnap.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it("should remove a firestore templates' category when it becomes uncategorized", async () => {
    const tmplId = uuid();
    const categoryId = uuid();
    const expected = {
      name: `test${tmplId}`,
      description: `desc${tmplId}`,
    };
    const beforeData = Object.assign({}, expected, { category: categoryId });

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmplId, beforeData); // add template /w category
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await templatesModel.firestoreUpsertRecord(fs, tmplId, beforeData); // add firestore template
    const beforeSnap = await templatesModel.realtimeFindRecord(db, tmplId);
    await db.ref(`/templates/${tmplId}/category`).remove(); // delete realtime template's category
    const afterSnap = await templatesModel.realtimeFindRecord(db, tmplId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.templateWrite);
    await wrapped(changeSnap, { params: { templateId: tmplId } });

    // Test result
    const docSnap = await templatesModel.firestoreFindRecord(fs, tmplId);
    const actual = docSnap.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
