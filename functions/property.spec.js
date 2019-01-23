const sinon = require('sinon');
const { expect } = require('chai');
const admin = require('firebase-admin');
const test = require('firebase-functions-test')();
const { createDatabaseStub } = require('./test-helpers/firebase');

const uuid = (function() {
  let i = 0;
  return () => `-${++i}`;
})();

describe('Property', function() {
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

    it('should remove all a property\'s `/propertyTemplates` when it gets deleted', function() {
      const propertyId = uuid();
      const templateOneId = uuid();
      const templateTwoId = uuid();
      const expected = {
        [`/propertyTemplates/${propertyId}/${templateOneId}`]: 'removed',
        [`/propertyTemplates/${propertyId}/${templateTwoId}`]: 'removed'
      };

      const wrapped = test.wrap(cloudFunctions.propertyWrite);
      const payload = {
        before: {
          exists: () => true,
          val: () => ({ templates: { [templateOneId]: true, [templateTwoId]: true } })
        },
        after: { exists: () => false } // property deleted
      };

      // Setup stubbed database
      Object.defineProperty(
        admin,
        'database',
        createDatabaseStub()
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
      const wrapped = test.wrap(cloudFunctions.propertyWrite);

      // Non-updated payload
      const templateRelationships = { [templateOneId]: true, [templateTwoId]: true };
      const templatesState = {
        exists: () => true,
        val: () => ({ templates: templateRelationships })
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
          val: () => templateRelationships
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
      const wrapped = test.wrap(cloudFunctions.propertyWrite);

      // Updated payload
      const beforeTemplateRelationships = { [templateOneId]: true, [templateTwoId]: true };
      const beforePayloadState = {
        exists: () => true,
        val: () => ({ templates: beforeTemplateRelationships })
      };
      const afterPayloadState = {
        exists: () => true,
        val: () => ({ templates: { [templateOneId]: true } }) // remove template two
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
          val: () => beforeTemplateRelationships
        })
      );

      return wrapped(payload, { params: { objectId: propertyId } })
      .then(actual => expect(expected).to.deep.equal(actual));
    });
  });
});
