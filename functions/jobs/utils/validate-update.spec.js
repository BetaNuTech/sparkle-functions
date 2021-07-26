const { expect } = require('chai');
const validate = require('./validate-update');
const config = require('../../config');

const update = {
  title: 'test',
  need: 'test',
  authorizedRules: config.jobs.authorizedRuleTypes[0],
  scopeOfWork: 'test',
  state: config.jobs.stateTypes[0],
  type: config.jobs.typeValues[0],
};

describe('Jobs | Utils | Validate Job Update', () => {
  it('rejects invalid job update attribute', () => {
    const data = [
      {
        job: { title: 1 },
        expected: 'title',
        msg: 'rejects non-string for title',
      },
      {
        job: { need: 1 },
        expected: 'need',
        msg: 'rejects non-string for need',
      },
      {
        job: { authorizedRules: 1 },
        expected: 'authorizedRules',
        msg: 'rejects non-string for authorizedRules',
      },
      {
        job: { scopeOfWork: 1 },
        expected: 'scopeOfWork',
        msg: 'rejects non-string for iscopeOfWorkd',
      },
      {
        job: { state: 1 },
        expected: 'state',
        msg: 'rejects non-string for state',
      },
      {
        job: { type: 1 },
        expected: 'type',
        msg: 'rejects non-string for type',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { job, expected, msg } = data[i];
      const result = validate(job);
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });

  it('accpets a valid job update', () => {
    const expected = [];
    const actual = validate({
      ...update,
    });

    expect(actual).to.deep.equal(expected);
  });
});
