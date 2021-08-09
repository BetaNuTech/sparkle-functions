const { expect } = require('chai');
const canUpdateState = require('./can-user-update-state');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const config = require('../../config/jobs');

describe('Jobs | Utils | Can User Update State', () => {
  it('only allows open jobs to transition to approved', () => {
    const user = mocking.createUser();
    const tests = config.stateTypes.map(state => ({
      expected: state === 'open',
      job: mocking.createJob({ state }),
      msg: `${
        state === 'open' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, job, msg } = tests[i];
      const actual = canUpdateState('approved', job, [], user);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved jobs to transition to authorized', () => {
    const user = mocking.createUser();
    const bids = [{ state: 'approved' }, {}, {}]; // 3 bids & 1 approved
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved',
      job: mocking.createJob({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, job, msg } = tests[i];
      const actual = canUpdateState('authorized', job, bids, user);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows authorized jobs to transition to complete', () => {
    const user = mocking.createUser();
    const bids = [{ state: 'approved' }, {}, {}]; // 3 bids & 1 approved
    const tests = config.stateTypes.map(state => ({
      expected: state === 'authorized',
      job: mocking.createJob({ state }),
      msg: `${
        state === 'authorized' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, job, msg } = tests[i];
      const actual = canUpdateState('complete', job, bids, user);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('rejects transition to authorized when job does not have at least 3 associated bids, even if one of them is approved', () => {
    const expected = false;
    const jobId = uuid();
    const actual = canUpdateState(
      'authorized',
      { id: jobId, state: 'approved', authorizedRules: 'default' },
      [{ job: uuid(), state: 'approved' }, { job: jobId, state: 'open' }],
      { admin: false }
    );

    expect(actual).to.equal(expected);
  });

  it('rejects transition to authorized for expedited job that does not have at least 1 approved bid', () => {
    const expected = false;
    const jobId = uuid();
    const actual = canUpdateState(
      'authorized',
      { id: jobId, state: 'approved', authorizedRules: 'expedite' },
      [{ job: uuid(), state: 'open' }, { job: jobId, state: 'open' }],
      { admin: true }
    );

    expect(actual).to.equal(expected);
  });

  it('rejects transition to authorized for job that only has 1 approved bid', () => {
    const expected = false;
    const jobId = uuid();
    const actual = canUpdateState(
      'authorized',
      { id: jobId, state: 'approved', authorizedRules: 'default' },
      [{ job: jobId, state: 'approved' }],
      { admin: true }
    );

    expect(actual).to.equal(expected);
  });

  it('accept transition to authorized by admin when an expedited job only has 1 approved bid', () => {
    const expected = true;
    const jobId = uuid();
    const actual = canUpdateState(
      'authorized',
      { id: jobId, state: 'approved', authorizedRules: 'expedite' },
      [{ job: jobId, state: 'approved' }],
      { admin: true }
    );

    expect(actual).to.equal(expected);
  });
});