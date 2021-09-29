const { expect } = require('chai');
const { getMinBids, getAuthorizedRules } = require('./job-authorization');

describe('Jobs | Utils | Job Authorization', () => {
  it('calculates minimum bids for each authorization rule set', () => {
    const data = [
      {
        authorizedRules: 'default',
        expected: 2,
      },
      {
        authorizedRules: 'large',
        expected: 3,
      },
      {
        authorizedRules: 'expedite',
        expected: 1,
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { authorizedRules, expected } = data[i];
      const actual = getMinBids(authorizedRules);
      expect(actual).to.equal(
        expected,
        `updated auth rule: "${authorizedRules}" to ${expected} min bids`
      );
    }
  });

  it('updates the jobs authorized rules for expected job types', () => {
    const data = [
      {
        authorizedRules: 'default',
        type: 'small:pm',
        expected: 'default',
        msg: 'small, non-expedited, job is default',
      },
      {
        authorizedRules: 'default',
        type: 'large:pm',
        expected: 'large',
        msg: 'large, non-expedited, job is large',
      },
      {
        authorizedRules: 'expedite',
        type: 'small:pm',
        expected: 'expedite',
        msg: 'small job is expedited',
      },
      {
        authorizedRules: 'expedite',
        type: 'large:pm',
        expected: 'expedite',
        msg: 'large job is expedited',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { authorizedRules, type, expected, msg } = data[i];
      const actual = getAuthorizedRules(authorizedRules, type);
      expect(actual).to.equal(expected, msg);
    }
  });
});
