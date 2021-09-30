const { expect } = require('chai');
const validateStateTransition = require('./validate-state-transition');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const config = require('../../config/jobs');

describe('Jobs | Utils | Can User Update State', () => {
  it('only allows applicable jobs to transition to approved', () => {
    const user = mocking.createUser();
    const attachment = mocking.createAttachment();
    const tests = [].concat(
      ...config.stateTypes.map(state => [
        {
          expected: false,
          job: mocking.createJob({
            state,
            scopeOfWork: '',
            scopeOfWorkAttachments: [],
          }),
          msg: `rejected transition from ${state} missing any SOW`,
        },
        {
          expected: state === 'open',
          job: mocking.createJob({
            state,
            scopeOfWork: 'scope',
            scopeOfWorkAttachments: [],
          }),
          msg: `${
            state === 'open' ? 'allowed' : 'rejected'
          } transition from ${state} with SOW text`,
        },
        {
          expected: state === 'open',
          job: mocking.createJob({
            state,
            scopeOfWork: '',
            scopeOfWorkAttachments: [attachment],
          }),
          msg: `${
            state === 'open' ? 'allowed' : 'rejected'
          } transition from ${state} with SOW attachment file`,
        },
      ])
    );

    for (let i = 0; i < tests.length; i++) {
      const { expected, job, msg } = tests[i];
      const actual =
        validateStateTransition('approved', job, [], user).length === 0; // is valid
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
      const actual =
        validateStateTransition('authorized', job, bids, user).length === 0; // is valid
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
      const actual =
        validateStateTransition('complete', job, bids, user).length === 0; // is valid
      expect(actual).to.equal(expected, msg);
    }
  });

  it('rejects transition to authorized when job does not meet min bid requirement, even if one of them is approved', () => {
    const expected = 'minBids';
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      { id: jobId, state: 'approved', minBids: 3, authorizedRules: 'default' },
      [
        { job: uuid(), state: 'approved' },
        { job: jobId, state: 'open' },
      ],
      { admin: false }
    );
    const actual = result.map(({ path }) => path).join('');
    expect(actual).to.contain(expected);
  });

  it('rejects transition to authorized for expedited job that does not have at least 1 approved bid', () => {
    const expected = 'bids';
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      { id: jobId, state: 'approved', authorizedRules: 'expedite' },
      [
        { job: uuid(), state: 'open' },
        { job: jobId, state: 'open' },
      ],
      { admin: true }
    );

    const actual = result.map(({ path }) => path).join('');
    expect(actual).to.contain(expected);
  });

  it('rejects transition to authorized by non-admin for large job that meets all bid requirements', () => {
    const expected = 'admin';
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      {
        id: jobId,
        type: 'large:am',
        state: 'approved',
        authorizedRules: 'large',
        minBids: 3,
      },
      [
        { job: jobId, state: 'approved' },
        { job: jobId, state: 'open' },
        { job: jobId, state: 'open' },
      ],
      { admin: false }
    );

    const actual = result.map(({ path }) => path).join('');
    expect(actual).to.contain(expected);
  });

  it('rejects transition to authorized for job that does not meet approved bid requirement', () => {
    const expected = 'bids';
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      {
        id: jobId,
        type: 'small:pm',
        state: 'approved',
        scopeOfWork: 's',
        authorizedRules: 'default',
        minBids: 2,
      },
      [
        { job: jobId, state: 'open' },
        { job: jobId, state: 'open' },
      ],
      { admin: true }
    );

    const actual = result.map(({ path }) => path).join('');
    expect(actual).to.contain(expected);
  });

  it('rejects transition to authorized for job that does not meet min bid requirement, even if bid is approved', () => {
    const expected = 'minBids';
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      {
        id: jobId,
        type: 'small:pm',
        state: 'approved',
        scopeOfWork: 's',
        authorizedRules: 'default',
        minBids: 2,
      },
      [{ job: jobId, state: 'approved' }],
      { admin: true }
    );

    const actual = result.map(({ path }) => path).join('');
    expect(actual).to.contain(expected);
  });

  it('accepts transition to authorized by admin when an expedited job only has 1 approved bid', () => {
    const expected = true;
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      {
        id: jobId,
        state: 'approved',
        scopeOfWork: 's',
        authorizedRules: 'expedite',
        minBids: 1,
      },
      [{ job: jobId, state: 'approved' }],
      { admin: true }
    );

    const actual = result.length === 0;
    expect(actual).to.equal(expected);
  });

  it('accepts transition to authorized by non-admin for small job that meets all bid requirements', () => {
    const expected = true;
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      {
        id: jobId,
        type: 'small:pm',
        state: 'approved',
        scopeOfWork: 's',
        authorizedRules: 'default',
        minBids: 2,
      },
      [
        { job: jobId, state: 'approved' },
        { job: jobId, state: 'open' },
      ],
      { admin: false }
    );

    const actual = result.length === 0;
    expect(actual).to.equal(expected);
  });

  it('accepts transition to authorized by admin for large job that meets all bid requirements', () => {
    const expected = true;
    const jobId = uuid();
    const result = validateStateTransition(
      'authorized',
      {
        id: jobId,
        type: 'large:am',
        state: 'approved',
        scopeOfWork: 's',
        authorizedRules: 'large',
        minBids: 3,
      },
      [
        { job: jobId, state: 'approved' },
        { job: jobId, state: 'open' },
        { job: jobId, state: 'rejected' },
      ],
      { admin: true }
    );

    const actual = result.length === 0;
    expect(actual).to.equal(expected);
  });
});
