const { expect } = require('chai');
const validateBidStateUpdate = require('./validate-bid-state-update');
const mocking = require('../../test-helpers/mocking');
const uuid = require('../../test-helpers/uuid');
const config = require('../../config/bids');
const jobConfig = require('../../config/jobs');

const PROPERTY_ID = uuid();
const ADMIN_USER = mocking.createUser({ admin: true });
const CORPORATE_USER = mocking.createUser({ corporate: true });
const PROPERTY_MANAGER = mocking.createUser({
  admin: false,
  corporate: false,
  properties: {
    [PROPERTY_ID]: true,
  },
});
const NO_ACCESS_USER = mocking.createUser({
  admin: false,
  corporate: false,
  teams: {},
  properties: {},
});
const JOB = mocking.createJob();
const READY_TO_APPROVE_BID = mocking.createBid({
  state: 'open',
  costMax: 2,
  costMin: 1,
  startAt: 1,
  completeAt: 2,
  vendorW9: true,
  vendorInsurance: true,
});

describe('Jobs | Utils | Validate Bid State Update', () => {
  it('only allows open bids to transition to approved', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'open' ? 0 : 1,
      data: mocking.createBid({ state }),
      msg: `${
        state === 'open' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const result = validateBidStateUpdate(
        ADMIN_USER,
        { state: 'approved' },
        data,
        JOB
      );
      const actual = result.length;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved bids to transition to incomplete', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved' ? 0 : 1,
      data: mocking.createBid({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const result = validateBidStateUpdate(
        ADMIN_USER,
        { state: 'incomplete' },
        data,
        JOB
      );
      const actual = result.length;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved bids to transition to rejected', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved' ? 0 : 1,
      data: mocking.createBid({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const result = validateBidStateUpdate(
        ADMIN_USER,
        { state: 'rejected' },
        data,
        JOB
      );
      const actual = result.length;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved bids to transition to completed', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved' ? 0 : 1,
      data: mocking.createBid({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const result = validateBidStateUpdate(
        ADMIN_USER,
        { state: 'completed' },
        data,
        JOB
      );
      const actual = result.length;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows rejected bids to transition to open', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'rejected' ? 0 : 1,
      data: mocking.createBid({ state }),
      msg: `${
        state === 'rejected' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const result = validateBidStateUpdate(
        ADMIN_USER,
        { state: 'open' },
        data,
        JOB
      );
      const actual = result.length;
      expect(actual).to.equal(expected, msg);
    }
  });

  it('rejects transition to approved if required bid attributes are not set', () => {
    const expected =
      'completeAt,costMax,costMin,startAt,vendorInsurance,vendorW9';
    const result = validateBidStateUpdate(
      ADMIN_USER,
      {
        state: 'approved',
      },
      { state: 'open' },
      JOB
    );

    const actual = result
      .map(({ path }) => path)
      .sort()
      .join(',');
    expect(actual).to.equal(expected);
  });

  it('does not allow no access users to approve a bid', () => {
    const expected = 'permission';
    const result = validateBidStateUpdate(
      NO_ACCESS_USER,
      { state: 'approved' },
      READY_TO_APPROVE_BID,
      JOB
    );

    const actual = result
      .map(({ type }) => type)
      .sort()
      .join(',');
    expect(actual).to.equal(expected);
  });

  it('only allows property managers to approve bids for small PM jobs', () => {
    const tests = jobConfig.typeValues.map(type => ({
      expected: type === 'small:pm',
      data: type,
      msg: `${
        type === 'small:pm' ? 'allows' : 'rejects'
      } property manager approval of ${type} job's bid`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const job = { ...JSON.parse(JSON.stringify(JOB)), type: data };
      const result = validateBidStateUpdate(
        PROPERTY_MANAGER,
        { state: 'approved' },
        READY_TO_APPROVE_BID,
        job
      );
      const actual = result.map(({ type }) => type).join('') !== 'permission';
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows corporate users to approve bids for all small jobs', () => {
    const tests = jobConfig.typeValues.map(type => ({
      expected: type.search('small') === 0,
      data: type,
      msg: `${
        type.search('small') === 0 ? 'allows' : 'rejects'
      } corporate approval of ${type} job's bid`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const job = { ...JSON.parse(JSON.stringify(JOB)), type: data };
      const result = validateBidStateUpdate(
        CORPORATE_USER,
        { state: 'approved' },
        READY_TO_APPROVE_BID,
        job
      );
      const actual = result.map(({ type }) => type).join('') !== 'permission';
      expect(actual).to.equal(expected, msg);
    }
  });

  it('allows admins to approve bids for all jobs', () => {
    const tests = jobConfig.typeValues.map(type => ({
      expected: true,
      data: type,
      msg: `allows admins to approve of ${type} job's bid`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, data, msg } = tests[i];
      const job = { ...JSON.parse(JSON.stringify(JOB)), type: data };
      const result = validateBidStateUpdate(
        ADMIN_USER,
        { state: 'approved' },
        READY_TO_APPROVE_BID,
        job
      );
      const actual = result.map(({ type }) => type).join('') !== 'permission';
      expect(actual).to.equal(expected, msg);
    }
  });
});
