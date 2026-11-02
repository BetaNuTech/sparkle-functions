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

describe('Properties | Utils | Validate Work Order | Assignees', () => {
  it('accepts a list of employee codes, including an empty list to clear', () => {
    expect(
      validate({ assignees: ['y1001249', 'richardp'] }, true)
    ).to.deep.equal([]);
    expect(validate({ assignees: [] }, true)).to.deep.equal([]);
    expect(validate({ unit: '101', assignees: ['y1001249'] })).to.deep.equal(
      []
    );
  });

  it('rejects assignees that are not a list of valid codes', () => {
    const cases = [
      { assignees: 'y1001249' },
      { assignees: [5] },
      { assignees: ['too-long-code-here'] },
      { assignees: ['bad code'] },
      { assignees: ['y1001249', 'y1001249'] },
    ];
    cases.forEach(workOrder => {
      const errors = validate(workOrder, true);
      expect(errors.map(({ path }) => path)).to.deep.equal(
        ['assignees'],
        JSON.stringify(workOrder)
      );
    });
  });
});

describe('Properties | Utils | Validate Work Order | Assignee hours', () => {
  it('accepts assignees as objects with optional hours, mixed with codes', () => {
    expect(
      validate(
        {
          assignees: [
            { code: 'y1001249', hours: 2.5 },
            { code: 'y1001290' },
            'richardp',
          ],
        },
        true
      )
    ).to.deep.equal([]);
  });

  it('rejects invalid hours and unknown assignee keys', () => {
    const cases = [
      { assignees: [{ code: 'y1001249', hours: '2' }] },
      { assignees: [{ code: 'y1001249', hours: -1 }] },
      { assignees: [{ code: 'y1001249', hours: 10000 }] },
      { assignees: [{ code: 'y1001249', hours: NaN }] },
      { assignees: [{ code: 'y1001249', name: 'David' }] },
      { assignees: [{ hours: 1 }] },
      { assignees: [{ code: 'y1001249' }, 'y1001249'] },
    ];
    cases.forEach(workOrder => {
      const errors = validate(workOrder, true);
      expect(errors.map(({ path }) => path)).to.deep.equal(
        ['assignees'],
        JSON.stringify(workOrder)
      );
    });
  });
});
