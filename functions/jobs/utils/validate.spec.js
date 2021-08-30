const { expect } = require('chai');
const validate = require('./validate');
const config = require('../../config');

const requiredAttrs = {
  title: 'test',
  need: 'test',
  authorizedRules: config.jobs.authorizedRuleTypes[0],
  scopeOfWork: 'test',
  property: {},
  createdAt: 123,
  updatedAt: 123,
  state: config.jobs.stateTypes[0],
  type: config.jobs.typeValues[0],
};

describe('Jobs | Utils | Validate Job Create', () => {
  it('rejects if required attributes are not provided in schema', () => {
    const expected =
      'title,authorizedRules,createdAt,updatedAt,state,type are required';
    const result = validate({
      telloCardURL: 'test',
    });
    const actual = `${result.map(err => err.path).join(',')} are required`;
    expect(actual).to.equal(expected);
  });

  it('rejects if non existing job attribute is provided', () => {
    const expected = [];
    const actual = validate({
      ...requiredAttrs,
      invalid: 'non-exixting',
    });

    expect(actual).to.deep.equal(expected);
  });

  it('rejects invalid job', () => {
    const data = [
      {
        job: { id: 1 },
        expected: 'id',
        msg: 'rejects non-string for id',
      },
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
        job: { trelloCardURL: 1 },
        expected: 'trelloCardURL',
        msg: 'rejects non-string for trelloCardURL',
      },
      {
        job: { createdAt: 'test' },
        expected: 'createdAt',
        msg: 'rejects non-number for createdAt',
      },
      {
        job: { updatedAt: 'test' },
        expected: 'updatedAt',
        msg: 'rejects non-number for updatedAt',
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
      const result = validate({ ...requiredAttrs, ...job });
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });

  it('accpets a valid job', () => {
    const expected = [];
    const actual = validate({
      id: '1',
      trelloCardURL: 'test',
      ...requiredAttrs,
    });

    expect(actual).to.deep.equal(expected);
  });
});
