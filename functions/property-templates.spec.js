const sinon = require('sinon');
const { expect } = require('chai');
const admin = require('firebase-admin');
const test = require('firebase-functions-test')();
const { createDatabaseStub } = require('./test-helpers/firebase');

const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

describe('Property Templates', function() {
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

    it('should remove all property\'s `propertyTemplates` when its\' templates are deleted', function() {
      const propertyId = uuid();
      const templateOneId = uuid();
      const templateTwoId = uuid();
      const expected = {
        [`/propertyTemplates/${propertyId}/${templateOneId}`]: 'removed',
        [`/propertyTemplates/${propertyId}/${templateTwoId}`]: 'removed'
      };
      const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
      const payload = {
        before: {
          exists: () => true,
          val: () => ({ [templateOneId]: true, [templateTwoId]: true })
        },
        after: { exists: () => false } // template field deleted
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {})
      );

      return wrapped(payload, { params: { objectId: propertyId } })
        .then(actual => expect(expected).to.deep.equal(actual));
    });

    it('should always upsert `propertyTemplates` when a property has any template relationships', function() {
      const propertyId = uuid();
      const templateOneId = uuid();
      const templateTwoId = uuid();
      const expected = {
        [`/propertyTemplates/${propertyId}/${templateOneId}`]: 'upserted',
        [`/propertyTemplates/${propertyId}/${templateTwoId}`]: 'upserted'
      };
      const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);

      // Non-updated payload
      const templatesState = {
        exists: () => true,
        val: () => ({ [templateOneId]: true, [templateTwoId]: true })
      };
      const payload = {
        before: templatesState,
        after: templatesState
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => true,
          val: () => templatesState.val()
        })
      );

      return wrapped(payload, { params: { objectId: propertyId } })
        .then(actual => expect(expected).to.deep.equal(actual));
    });

    it('should remove from `propertyTemplates` any template disassociated from a property', function() {
      const propertyId = uuid();
      const templateOneId = uuid();
      const templateTwoId = uuid();
      const expected = {
        [`/propertyTemplates/${propertyId}/${templateOneId}`]: 'upserted',
        [`/propertyTemplates/${propertyId}/${templateTwoId}`]: 'removed'
      };
      const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);

      // Updated payload
      const beforePayloadState = {
        exists: () => true,
        val: () => ({ [templateOneId]: true, [templateTwoId]: true })
      };
      const afterPayloadState = {
        exists: () => true,
        val: () => ({ [templateOneId]: true })
      };
      const payload = {
        before: beforePayloadState,
        after: afterPayloadState
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub({}, {
          exists: () => true,
          val: () => beforePayloadState.val()
        })
      );

      return wrapped(payload, { params: { objectId: propertyId } })
      .then(actual => expect(expected).to.deep.equal(actual));
    });
  });
});
