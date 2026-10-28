const { expect } = require('chai');
const validate = require('./validate-work-order-attachment');

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Properties | Utils | Validate Work Order Attachment', () => {
  it('accepts base64 data with an extension and optional description', () => {
    expect(validate({ data: PNG, extension: 'png' })).to.deep.equal([]);
    expect(
      validate({ data: PNG, extension: '.PNG', description: 'Pool gate' })
    ).to.deep.equal([]);
  });

  it('requires data and an extension', () => {
    const paths = validate({}).map(({ path }) => path);
    expect(paths).to.include('data');
    expect(paths).to.include('extension');
  });

  it('rejects data that is not base64', () => {
    const errors = validate({ data: 'not base64!!', extension: 'png' });
    expect(errors.map(({ path }) => path)).to.deep.equal(['data']);
  });

  it('rejects data larger than the maximum', () => {
    const big = Buffer.alloc(validate.MAX_BYTES + 1, 1).toString('base64');
    const errors = validate({ data: big, extension: 'png' });
    expect(errors.map(({ path }) => path)).to.deep.equal(['data']);
    expect(errors[0].message).to.contain('MB or smaller');
  });

  it('rejects a malformed extension', () => {
    const errors = validate({ data: PNG, extension: 'tar.gz' });
    expect(errors.map(({ path }) => path)).to.deep.equal(['extension']);
  });

  it('rejects a description that is too long or not text', () => {
    expect(
      validate({
        data: PNG,
        extension: 'png',
        description: 'x'.repeat(101),
      }).map(({ path }) => path)
    ).to.deep.equal(['description']);
    expect(
      validate({ data: PNG, extension: 'png', description: 5 }).map(
        ({ path }) => path
      )
    ).to.deep.equal(['description']);
  });

  it('rejects unknown attributes', () => {
    const errors = validate({ data: PNG, extension: 'png', name: 'mine.png' });
    expect(errors.map(({ path }) => path)).to.deep.equal(['name']);
  });
});
