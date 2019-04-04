const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Deficient Items Overdue Sync', () => {
  afterEach(() => cleanDb(db));

  // it('should not set non-pending, past due, deficiency items to overdue', async () => {});
  // it('should not set pending, non-due, deficiency items to overdue', async () => {});
  // it('should set all pending, past due, deficiency items to overdue', async () => {});
});
