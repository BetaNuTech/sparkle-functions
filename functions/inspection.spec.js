const sinon = require('sinon');
const { expect } = require('chai');
const admin = require('firebase-admin');
const test = require('firebase-functions-test')();
const { createDatabaseStub } = require('./test-helpers/firebase');

const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

describe('Inspection', function() {
  let cloudFunctions, adminInitStub;

  before(() => {
    // Stub admin.initializeApp to avoid live database access
    if (!admin.initializeApp.isSinonProxy) {
      adminInitStub = sinon.stub(admin, 'initializeApp').returns({ database: () => admin });
    }
    cloudFunctions = require('./index');
  });

  describe('On Updated Last Date Write', function() {
    let oldDatabase;
    before(() => oldDatabase = admin.database);
    after(() => admin.database = oldDatabase);

    it('should update propertyInspections and nested copy in property with new data', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = createInspection({ property: propertyId, inspectionCompleted: false });
      const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
      const payload = {
        before: { val: () => Date.now() / 1000 },
        after: changeAfterStub(expected)
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ single incomplete inspection
          exists: () => true,
          hasChildren: () => false,
          val: () => ({ inspectionCompleted: false })
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
        .then(actual => {
          delete expected.property;
          expect(expected).to.deep.equal(
            actual[`/properties/${propertyId}/inspections/${inspectionId}`],
            'nested property inspection clone updated'
          );
          expect(expected).to.deep.equal(
            actual[`/propertyInspections/${propertyId}/inspections/${inspectionId}`],
            'propertyInspection updated'
          );
        });
    });

    it('should update completedInspections with a completed inspections\' data', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = createInspection({ property: propertyId, inspectionCompleted: true });
      const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
      const payload = {
        before: { val: () => Date.now() / 1000 },
        after: changeAfterStub(expected)
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ single incomplete inspection
          exists: () => true,
          hasChildren: () => false,
          val: () => ({ inspectionCompleted: false })
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
      .then(actual => {
        delete expected.totalItems;
        delete expected.itemsCompleted;
        expect(expected).to.deep.equal(
          actual[`/completedInspections/${inspectionId}`],
          'updated completedInspections with inspection data'
        );
      });
    });

    it('should ensure an incomplete inspection does not exist in completedInspections', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = 'removed';
      const inspection = createInspection({ property: propertyId, inspectionCompleted: false });
      const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
      const payload = {
        before: { val: () => Date.now() / 1000 },
        after: changeAfterStub(inspection)
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ single incomplete inspection
          exists: () => true,
          hasChildren: () => false,
          val: () => ({ inspectionCompleted: false })
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
        .then(actual => {
          expect(expected).to.equal(
            actual[`/completedInspections/${inspectionId}`],
            'removed inspection from completedInspections'
          );
        });
    });

    it('should update property with any meta data from its\' completed inspections', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const newest = (Date.now() / 1000);
      const oldest = (Date.now() / 1000) - 100000;
      const inspectionOne = createInspection({ property: propertyId, inspectionCompleted: true, creationDate: newest, score: 65 });
      const inspectionTwo = createInspection({ property: propertyId, inspectionCompleted: true, creationDate: oldest, score: 25 });
      const expected = {
        numOfInspections: 2,
        lastInspectionScore: inspectionOne.score,
        lastInspectionDate: inspectionOne.creationDate
      };
      const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
      const payload = {
        before: { val: () => Date.now() / 1000 },
        after: changeAfterStub(inspectionOne)
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ 2 completed inspections
          exists: () => true,
          hasChildren: () => true,
          forEach: (fn) => {
            [
              { val: () => inspectionOne },
              { val: () => inspectionTwo }
            ].forEach(fn);
          }
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
      .then(actual => {
        expect(expected.numOfInspections).to.equal(
          actual[`/properties/${propertyId}/numOfInspections`],
          'updated property\'s `numOfInspections`'
        );
        expect(expected.lastInspectionScore).to.equal(
          actual[`/properties/${propertyId}`].lastInspectionScore,
          'updated property\'s `lastInspectionScore`'
        );
        expect(expected.lastInspectionDate).to.equal(
          actual[`/properties/${propertyId}`].lastInspectionDate,
          'updated property\'s `lastInspectionDate`'
        );
      });
    });
  });

  describe('On Write', function() {
    let oldDatabase;
    before(() => oldDatabase = admin.database);
    after(() => admin.database = oldDatabase);

    it('should remove completedInspection when inspection is deleted', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = 'removed';
      const wrapped = test.wrap(cloudFunctions.inspectionWrite);
      const inspection = createInspection({ property: propertyId, inspectionCompleted: true });
      const payload = {
        after: {
          exists: () => false // inspection deleted
        },
        before: {
          val: () => inspection
        }
      }

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub()
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
        .then(actual => {
          expect(expected).to.deep.equal(
            actual[`/completedInspections/${inspectionId}`],
            'removed from completedInspections'
          );
        });
    });

    it('should remove propertyInspections and nested inspection when deleted', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = 'removed';
      const wrapped = test.wrap(cloudFunctions.inspectionWrite);
      const inspection = createInspection({ property: propertyId, inspectionCompleted: false });
      const payload = {
        after: {
          exists: () => false // inspection deleted
        },
        before: {
          val: () => inspection
        }
      }

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub()
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
        .then(actual => {
          expect(expected).to.deep.equal(
            actual[`/properties/${propertyId}/inspections/${inspectionId}`],
            'removed nested inspection from property'
          );
          expect(expected).to.deep.equal(
            actual[`/propertyInspections/${propertyId}/inspections/${inspectionId}`],
            'removed from propertyInspections'
          );
        });
    });

    it('should update propertyInspections and nested copy in property with new data', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = createInspection({ property: propertyId, inspectionCompleted: false });
      const wrapped = test.wrap(cloudFunctions.inspectionWrite);
      const payload = {
        after: {
          exists: () => true,
          val: () => expected
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ single incomplete inspection
          exists: () => true,
          hasChildren: () => false,
          val: () => ({ inspectionCompleted: false })
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
        .then(actual => {
          delete expected.property;
          expect(expected).to.deep.equal(
            actual[`/properties/${propertyId}/inspections/${inspectionId}`],
            'nested property inspection clone updated'
          );
          expect(expected).to.deep.equal(
            actual[`/propertyInspections/${propertyId}/inspections/${inspectionId}`],
            'propertyInspection updated'
          );
        });
    });

    it('should update completedInspections with a completed inspections\' data', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = createInspection({ property: propertyId, inspectionCompleted: true });
      const wrapped = test.wrap(cloudFunctions.inspectionWrite);
      const payload = {
        after: {
          exists: () => true,
          val: () => expected
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ single incomplete inspection
          exists: () => true,
          hasChildren: () => false,
          val: () => ({ inspectionCompleted: false })
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
      .then(actual => {
        delete expected.totalItems;
        delete expected.itemsCompleted;
        expect(expected).to.deep.equal(
          actual[`/completedInspections/${inspectionId}`],
          'updated completedInspections with inspection data'
        );
      });
    });

    it('should ensure an incomplete inspection does not exist in completedInspections', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const expected = 'removed';
      const inspection = createInspection({ property: propertyId, inspectionCompleted: false });
      const wrapped = test.wrap(cloudFunctions.inspectionWrite);
      const payload = {
        after: {
          exists: () => true,
          val: () => inspection
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ single incomplete inspection
          exists: () => true,
          hasChildren: () => false,
          val: () => ({ inspectionCompleted: false })
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
        .then(actual => {
          expect(expected).to.equal(
            actual[`/completedInspections/${inspectionId}`],
            'removed inspection from completedInspections'
          );
        });
    });

    it('should update property with any meta data from its\' completed inspections', function() {
      const inspectionId = uuid();
      const propertyId = uuid();
      const newest = (Date.now() / 1000);
      const oldest = (Date.now() / 1000) - 100000;
      const inspectionOne = createInspection({ property: propertyId, inspectionCompleted: true, creationDate: newest, score: 65 });
      const inspectionTwo = createInspection({ property: propertyId, inspectionCompleted: true, creationDate: oldest, score: 25 });
      const expected = {
        numOfInspections: 2,
        lastInspectionScore: inspectionOne.score,
        lastInspectionDate: inspectionOne.creationDate
      };
      const wrapped = test.wrap(cloudFunctions.inspectionWrite);
      const payload = {
        after: {
          exists: () => true,
          val: () => inspectionOne
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, { // property w/ 2 completed inspections
          exists: () => true,
          hasChildren: () => true,
          forEach: (fn) => {
            [
              { val: () => inspectionOne },
              { val: () => inspectionTwo }
            ].forEach(fn);
          }
        })
      );

      return wrapped(payload, { params: { objectId: inspectionId } })
      .then(actual => {
        expect(expected.numOfInspections).to.equal(
          actual[`/properties/${propertyId}/numOfInspections`],
          'updated property\'s `numOfInspections`'
        );
        expect(expected.lastInspectionScore).to.equal(
          actual[`/properties/${propertyId}`].lastInspectionScore,
          'updated property\'s `lastInspectionScore`'
        );
        expect(expected.lastInspectionDate).to.equal(
          actual[`/properties/${propertyId}`].lastInspectionDate,
          'updated property\'s `lastInspectionDate`'
        );
      });
    });
  });
});

/**
 * Creates a stub for lookup of a parent record
 * from a single Firebase property
 * @param  {Object} inspection
 * @return {Object}
 */
function changeAfterStub(inspection = {}) {
  return {
    exists: () => true,
    val: () => ((Date.now() + 1) / 1000),
    ref: {
      parent: {
        once: () => Promise.resolve({
          exists: () => true,
          val: () => Object.assign({ template: {} }, inspection)
        })
      }
    }
  }
}

/**
 * Create a randomized inspection object
 * @param  {Object} config
 * @return {Object}
 */
function createInspection(config) {
  if (!config.property) {
    throw new Error('createInspection requires a `property`');
  }

  const now = Date.now() / 1000;
  const offset = Math.floor(Math.random * 100);
  const items = Math.floor(Math.random * 100);
  const completed = config.inspectionCompleted || false;

  return Object.assign({
    creationDate: (now - offset),
    deficienciesExist: Math.random() > .5 ? true : false,
    inspectionCompleted: completed,
    inspector: `user-${offset * 2}`,
    inspectorName: 'test-user',
    itemsCompleted: completed ? items : (items / 2),
    score: Math.random() > .5 ? 100 : Math.random(),
    templateName: `test-${offset * 3}`,
    totalItems: items,
    updatedLastDate: (now - (offset / 2))
  }, config);
}
