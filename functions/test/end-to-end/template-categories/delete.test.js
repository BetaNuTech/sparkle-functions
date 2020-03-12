const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const templatesModel = require('../../../models/templates');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Template Categories | Delete', () => {
  afterEach(() => cleanDb(db, fs));

  it('should disassociate all realtime templates belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(tmpl1Data); // add template #1
    await db.ref(`/templates/${tmpl2Id}`).set(tmpl2Data); // add template #2
    await db.ref(`/templates/${tmpl3Id}`).set(tmpl3Data); // add template #3
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `category${categoryId}` }); // add category
    const deleteSnap = await db
      .ref(`/templateCategories/${categoryId}`)
      .once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(deleteSnap, { params: { categoryId } });

    // Test result
    const actualTmpl1Cat = await db
      .ref(`/templates/${tmpl1Id}/category`)
      .once('value');
    const actualTmpl2Cat = await db
      .ref(`/templates/${tmpl2Id}/category`)
      .once('value');
    const actualTmpl3Cat = await db
      .ref(`/templates/${tmpl3Id}/category`)
      .once('value');

    // Assertions
    expect(actualTmpl1Cat.val()).to.equal(
      null,
      'removed template 1 relationship'
    );
    expect(actualTmpl2Cat.val()).to.equal(
      null,
      'removed template 2 relationship'
    );
    expect(actualTmpl3Cat.val()).to.equal(
      tmpl3Data.category,
      'template 3 relationship unchanged'
    );
  });

  it('should disassociate all realtime template lists belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(tmpl1Data); // add template #1
    await templatesModel.realtimeUpsertListRecord(db, tmpl1Id, tmpl1Data); // add template #1 proxy
    await db.ref(`/templates/${tmpl2Id}`).set(tmpl2Data); // add template #2
    await templatesModel.realtimeUpsertListRecord(db, tmpl2Id, tmpl2Data); // add template #2 proxy
    await db.ref(`/templates/${tmpl3Id}`).set(tmpl3Data); // add template #3
    await templatesModel.realtimeUpsertListRecord(db, tmpl3Id, tmpl3Data); // add template #3 proxy
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `category${categoryId}` }); // add category
    const deleteSnap = await db
      .ref(`/templateCategories/${categoryId}`)
      .once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(deleteSnap, { params: { categoryId } });

    // Test result
    const actualTmpl1Cat = await db
      .ref(`/templatesList/${tmpl1Id}/category`)
      .once('value');
    const actualTmpl2Cat = await db
      .ref(`/templatesList/${tmpl2Id}/category`)
      .once('value');
    const actualTmpl3Cat = await db
      .ref(`/templatesList/${tmpl3Id}/category`)
      .once('value');
    const actualTmpl1 = await db.ref(`/templatesList/${tmpl1Id}`).once('value');

    // Assertions
    expect(actualTmpl1Cat.val()).to.equal(
      null,
      'removed template 1 proxy relationship'
    );
    expect(actualTmpl2Cat.val()).to.equal(
      null,
      'removed template 2 proxy relationship'
    );
    expect(actualTmpl3Cat.val()).to.equal(
      tmpl3Data.category,
      'template 3 proxy relationship unchanged'
    );
    expect(actualTmpl1.val().name).to.equal(
      tmpl1Data.name,
      'non-category attributes unchanged'
    );
  });

  it('should disassociate all firestore templates belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(tmpl1Data); // add template #1
    await templatesModel.firestoreUpsertRecord(fs, tmpl1Id, tmpl1Data); // add firestore template #1
    await db.ref(`/templates/${tmpl2Id}`).set(tmpl2Data); // add template #2
    await templatesModel.firestoreUpsertRecord(fs, tmpl2Id, tmpl2Data); // add firestore template #2
    await db.ref(`/templates/${tmpl3Id}`).set(tmpl3Data); // add template #3
    await templatesModel.firestoreUpsertRecord(fs, tmpl3Id, tmpl3Data); // add firestore template #2
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `category${categoryId}` }); // add category
    const deleteSnap = await db
      .ref(`/templateCategories/${categoryId}`)
      .once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(deleteSnap, { params: { categoryId } });

    // Test result
    const docSnaps = await templatesModel.firestoreFindAll(fs);

    // Assertions
    [
      {
        value: docSnaps.find(doc => doc.id === tmpl1Id),
        expected: null,
        msg: 'removed template 1 category relationship',
      },
      {
        value: docSnaps.find(doc => doc.id === tmpl2Id),
        expected: null,
        msg: 'removed template 2 category relationship',
      },
      {
        value: docSnaps.find(doc => doc.id === tmpl3Id),
        expected: tmpl3Data.category,
        msg: 'template 3 category relationship unchanged',
      },
    ].forEach(({ value, expected, msg }) => {
      const actual = value.data().category;
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should disassociate all property templates lists belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(tmpl1Data); // add template #1
    await db.ref(`/properties/${propertyId}`).set({
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    }); // required
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`)
      .set(tmpl1Data); // add template #1 proxy
    await db.ref(`/templates/${tmpl2Id}`).set(tmpl2Data); // add template #2
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}`)
      .set(tmpl2Data); // add template #2 proxy
    await db.ref(`/templates/${tmpl3Id}`).set(tmpl3Data); // add template #3
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}`)
      .set(tmpl3Data); // add template #2 proxy
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `category${categoryId}` }); // add category
    const deleteSnap = await db
      .ref(`/templateCategories/${categoryId}`)
      .once('value');

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(deleteSnap, { params: { categoryId } });

    // Test result
    const actualTmpl1Cat = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}/category`)
      .once('value');
    const actualTmpl2Cat = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}/category`)
      .once('value');
    const actualTmpl3Cat = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}/category`)
      .once('value');
    const actualTmpl1 = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`)
      .once('value');

    // Assertions
    expect(actualTmpl1Cat.val()).to.equal(
      null,
      'removed property template 1 proxy category'
    );
    expect(actualTmpl2Cat.val()).to.equal(
      null,
      'removed property template 2 proxy category'
    );
    expect(actualTmpl3Cat.val()).to.equal(
      tmpl3Data.category,
      'property template 3 proxy category unchanged'
    );
    expect(actualTmpl1.val().name).to.equal(
      tmpl1Data.name,
      'non-category attributes unchanged'
    );
  });
});
