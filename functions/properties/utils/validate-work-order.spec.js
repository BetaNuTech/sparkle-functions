const { expect } = require('chai');
const validate = require('./validate-work-order');

describe('Properties | Utils | Validate Work Order', () => {
  it('does not require a unit when creating, for common area requests', () => {
    const errors = validate({ briefDescription: 'test' });
    expect(errors).to.deep.equal([]);
  });

  it('does not require a unit when updating', () => {
    const errors = validate({ briefDescription: 'test' }, true);
    expect(errors).to.deep.equal([]);
  });

  it('rejects an empty create', () => {
    const errors = validate({});
    expect(errors.length).to.equal(1);
    expect(errors[0].message).to.contain('at least one attribute');
  });

  it('rejects an empty update', () => {
    const errors = validate({}, true);
    expect(errors.length).to.equal(1);
    expect(errors[0].message).to.contain('at least one attribute');
  });

  it('rejects values over the Yardi maximum lengths', () => {
    const errors = validate({
      unit: '123456789', // 9 > 8
      briefDescription: 'x'.repeat(36), // 36 > 35
      description: 'ok',
    });
    expect(errors.map(({ path }) => path).sort()).to.deep.equal([
      'briefDescription',
      'unit',
    ]);
  });

  it('rejects non-string text attributes', () => {
    const errors = validate({ unit: 101 });
    expect(errors.map(({ path }) => path)).to.include('unit');
  });

  it('rejects non-boolean flags', () => {
    const errors = validate({ unit: '101', permissionToEnter: 'yes' });
    expect(errors.map(({ path }) => path)).to.include('permissionToEnter');
  });

  it('rejects unknown attributes', () => {
    const errors = validate({ unit: '101', bogus: 'nope' });
    expect(errors.length).to.equal(1);
    expect(errors[0].path).to.equal('bogus');
  });

  it('accepts a complete valid work order', () => {
    const errors = validate({
      unit: '101',
      resident: 't0001',
      briefDescription: 'Leaky faucet',
      description: 'Kitchen faucet drips',
      priority: 'Low',
      category: 'Plumbing',
      permissionToEnter: true,
      tenantCaused: false,
      requestorName: 'Testor',
      requestorPhone: '1234567890',
      requestorEmail: 'test@email.com',
      status: 'Call',
    });
    expect(errors).to.deep.equal([]);
  });
});
