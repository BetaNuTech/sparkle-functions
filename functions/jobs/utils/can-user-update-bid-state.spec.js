const { expect } = require('chai');
const canUpdateState = require('./can-user-update-bid-state');
const mocking = require('../../test-helpers/mocking');
const config = require('../../config/bids');

describe('Jobs | Utils | Can Update Bid State', () => {
  it('only allows open bids to transition to approved', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'open',
      bidConfig: mocking.createBid({ state }),
      msg: `${
        state === 'open' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, bidConfig, msg } = tests[i];
      const actual = canUpdateState({ state: 'approved' }, bidConfig);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved bids to transition to incomplete', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved',
      bidConfig: mocking.createBid({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, bidConfig, msg } = tests[i];
      const actual = canUpdateState({ state: 'incomplete' }, bidConfig);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved bids to transition to rejected', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved',
      bidConfig: mocking.createBid({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, bidConfig, msg } = tests[i];
      const actual = canUpdateState({ state: 'rejected' }, bidConfig);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows approved bids to transition to completed', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'approved',
      bidConfig: mocking.createBid({ state }),
      msg: `${
        state === 'approved' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, bidConfig, msg } = tests[i];
      const actual = canUpdateState({ state: 'completed' }, bidConfig);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('only allows rejected bids to transition to open', () => {
    const tests = config.stateTypes.map(state => ({
      expected: state === 'rejected',
      bidConfig: mocking.createBid({ state }),
      msg: `${
        state === 'rejected' ? 'allowed' : 'rejected'
      } transition from ${state}`,
    }));

    for (let i = 0; i < tests.length; i++) {
      const { expected, bidConfig, msg } = tests[i];
      const actual = canUpdateState({ state: 'open' }, bidConfig);
      expect(actual).to.equal(expected, msg);
    }
  });

  it('rejects transition to approved if required bid attributes are not set', () => {
    const expected = false;
    const actual = canUpdateState(
      {
        state: 'approved',
      },
      { state: 'open' }
    );

    expect(actual).to.equal(expected);
  });
});
