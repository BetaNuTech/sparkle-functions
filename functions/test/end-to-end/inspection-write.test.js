const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Inspection Write', () => {
  afterEach(() => cleanDb(db));

  it('should set an invalid score value to zero', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now,
      inspectionCompleted: true
    };
    const afterData = Object.assign({}, beforeData, { score: null });

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    yield db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}` }); // required
    yield db.ref(`/completedInspections/${inspId}`).set(beforeData); // Add completedInspections
    yield db.ref(`/completedInspectionsList/${inspId}`).set(beforeData); // Add completedInspectionsList
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).set(beforeData); // Add propertyInspections
    yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).set(beforeData); // Add propertyInspectionsList
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // set invalid score
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Test result
    const paths = [
      `/completedInspections/${inspId}/score`,
      `/completedInspectionsList/${inspId}/score`,
      `/propertyInspections/${propertyId}/inspections/${inspId}/score`,
      `/propertyInspectionsList/${propertyId}/inspections/${inspId}/score`
    ];
    const results = yield Promise.all(paths.map(p => db.ref(p).once('value')));

    // Assertions
    results.forEach((scoreSnap, i) => {
      const actual = scoreSnap.val();
      expect(actual).to.equal(0, `test for ${paths[i]} set score to 0`);
    });
  }));

  it('should update inspections\' proxy records with new data', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: true
    };

    const afterData = Object.assign({}, beforeData, {
      templateName: `name${inspId}--rev2`,
      inspectorName: 'testor--rev2',
      score: 8,
      templateCategory: categoryId,
      deficienciesExist: true,
      updatedLastDate: now,
    });

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    yield db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}` }); // required
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // Add inspections' category
    yield db.ref(`/completedInspections/${inspId}`).set(beforeData); // Add completedInspections
    yield db.ref(`/completedInspectionsList/${inspId}`).set(beforeData); // Add completedInspections
    yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).set(beforeData); // Add propertyInspections
    yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).set(beforeData); // Add propertyInspectionsList
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // Remove inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Test result
    const propertyInspection = yield db.ref(`/propertyInspections/${propertyId}/inspections/${inspId}`).once('value');
    const propertyInspectionList = yield db.ref(`/propertyInspectionsList/${propertyId}/inspections/${inspId}`).once('value');
    const completedInspection = yield db.ref(`/completedInspections/${inspId}`).once('value');
    const completedInspectionList = yield db.ref(`/completedInspectionsList/${inspId}`).once('value');

    // Assertions
    const expected = Object.assign({}, afterData);
    delete expected.property;
    expect(propertyInspection.val()).to.deep.equal(expected, 'updated /propertyInspections proxy');
    expect(propertyInspectionList.val()).to.deep.equal(expected, 'updated /propertyInspectionsList proxy');

    const expectedCompleted = Object.assign({}, afterData);
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    delete expectedCompleted.templateCategory;
    expect(completedInspection.val()).to.deep.equal(expectedCompleted, 'updated /completedInspections proxy');
    expect(completedInspectionList.val()).to.deep.equal(expectedCompleted, 'updated /completedInspectionsList proxy');
  }));

  it('should update completedInspections when inspection becomes completed', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 9,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: false
    };

    const afterData = Object.assign({}, beforeData, {
      itemsCompleted: 10,
      updatedLastDate: now,
      inspectionCompleted: true
    });

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}` }); // required
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // Update inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Test result
    const actual = yield db.ref(`/completedInspections/${inspId}`).once('value');
    const actualList = yield db.ref(`/completedInspectionsList/${inspId}`).once('value');

    // Assertions
    const expected = Object.assign({}, afterData);
    delete expected.itemsCompleted;
    delete expected.totalItems;
    expect(actual.val()).to.deep.equal(expected, 'updated /completedInspections proxy');
    expect(actualList.val()).to.deep.equal(expected, 'updated /completedInspectionsList proxy');
  }));

  it('should ensure an incomplete inspection does not exist in any completed proxy records', () => co(function *() {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: false
    };

    const afterData = Object.assign({}, beforeData, { updatedLastDate: now });

    // Setup database
    yield db.ref(`/inspections/${inspId}`).set(beforeData); // Add inspection
    const beforeSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create before
    yield db.ref(`/inspections/${inspId}`).update(afterData); // Update inspection
    const afterSnap = yield db.ref(`/inspections/${inspId}`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: inspId } });

    // Test result
    const actual = yield db.ref(`/completedInspections/${inspId}`).once('value');
    const actualList = yield db.ref(`/completedInspectionsList/${inspId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false, '/completedInspections proxy does not exist');
    expect(actualList.exists()).to.equal(false, '/completedInspectionsList proxy does not exist');
  }));

  it('should update property with any meta data from its\' completed inspections', () => co(function *() {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = (Date.now() / 1000);
    const oldest = (Date.now() / 1000) - 100000;
    const deficientInspItems = {
    }
    const inspectionOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
      // Create template w/ 1 deficient item
      template: { items: { [uuid()]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) } }
    });
    const inspectionTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
      // Create template w/ 1 deficient item
      template: { items: { [uuid()]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) } }
    });
    const expected = {
      numOfInspections: 2,
      lastInspectionScore: inspectionOne.score,
      lastInspectionDate: inspectionOne.creationDate,
      numOfDeficientItems: 2,
      numOfRequiredActionsForDeficientItems: 2
    };

    // Setup database
    yield db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}` }); // required
    yield db.ref(`/inspections/${insp1Id}`).set(inspectionOne); // Add inspection #1
    yield db.ref(`/inspections/${insp2Id}`).set(inspectionTwo); // Add inspection #2
    const snap = yield db.ref(`/inspections/${insp1Id}`).once('value'); // Create snapshot

    // Execute
    const changeSnap = test.makeChange(snap, snap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    yield wrapped(changeSnap, { params: { objectId: insp1Id } });

    // Test result
    const propertySnap = yield db.ref(`/properties/${propertyId}`).once('value');
    const actual = propertySnap.val();

    // Assertions
    expect(actual.numOfInspections).to.equal(
      expected.numOfInspections,
      'updated property\'s `numOfInspections`'
    );
    expect(actual.lastInspectionScore).to.equal(
      expected.lastInspectionScore,
      'updated property\'s `lastInspectionScore`'
    );
    expect(actual.lastInspectionDate).to.equal(
      expected.lastInspectionDate,
      'updated property\'s `lastInspectionDate`'
    );
    expect(actual.numOfDeficientItems).to.equal(
      expected.numOfDeficientItems,
      'updated property\'s `numOfDeficientItems`'
    );
    expect(actual.numOfRequiredActionsForDeficientItems).to.equal(
      expected.numOfRequiredActionsForDeficientItems,
      'updated property\'s `numOfRequiredActionsForDeficientItems`'
    );
  }));
});
