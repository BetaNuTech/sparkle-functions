const sinon = require('sinon');
const { expect } = require('chai');
const admin = require('firebase-admin');
const test = require('firebase-functions-test')();
const { createDatabaseStub } = require('./test-helpers/firebase');

const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

describe('Template', function() {
  let cloudFunctions, adminInitStub;

  before(() => {
    // Stub admin.initializeApp to avoid live database access
    if (!admin.initializeApp.isSinonProxy) {
      adminInitStub = sinon.stub(admin, 'initializeApp').returns({ database: () => admin });
    }
    cloudFunctions = require('./index');
  });

  describe('On Write', function() {
    let oldDatabase;
    before(() => oldDatabase = admin.database);
    after(() => admin.database = oldDatabase);

    it('should remove all `/propertyTemplates` belonging to a deleted template', function() {
      const templateId = uuid();
      const propertyOneId = uuid();
      const propertyTwoId = uuid();
      const expected = {
        [`/propertyTemplates/${propertyOneId}/${templateId}`]: 'removed',
        [`/propertyTemplates/${propertyTwoId}/${templateId}`]: 'removed'
      };

      const wrapped = test.wrap(cloudFunctions.templateWrite);
      const payload = {
        before: { exists: () => true },
        after: { exists: () => false } // template deleted
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => true,
          val: () => ({
            [propertyOneId]: { [templateId]: true },
            [propertyTwoId]: { [templateId]: true }
          })
        })
      );

      return wrapped(payload, { params: { objectId: templateId } })
        .then(actual => expect(expected).to.deep.equal(actual));
    });

    it('should update `/propertyTemplates` belonging to an updated template', function() {
      const templateId = uuid();
      const propertyOneId = uuid();
      const propertyTwoId = uuid();
      const expected = {
        [`/propertyTemplates/${propertyOneId}/${templateId}`]: 'updated',
        [`/propertyTemplates/${propertyTwoId}/${templateId}`]: 'updated'
      };

      const wrapped = test.wrap(cloudFunctions.templateWrite);
      const payload = {
        before: { exists: () => true },
        after: {
          exists: () => true,
          val: () => ({})
        }
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => true,
          val: () => ({
            [propertyOneId]: { [templateId]: true },
            [propertyTwoId]: { [templateId]: true }
          })
        })
      );

      return wrapped(payload, { params: { objectId: templateId } })
        .then(actual => expect(expected).to.deep.equal(actual));
    });
  });
});
