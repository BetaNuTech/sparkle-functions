const { expect } = require('chai');
const {
  isValidYardiResidentOccupant,
  createResidentFromYardiCustomer,
  createOccupantFromYardiOccupant,
  isValidYardiWorkOrder,
  createWorkOrderFromYardi,
  _getYardiPhoneNumbers: getYardiPhoneNumbers,
} = require('./yardi-helpers');

describe('Service | Utils | Yardi Helpers', () => {
  describe('Resident/Occupant Validation', () => {
    it('rejects missing identifier', () => {
      const validName = createCustomer({ firstName: 'a', lastName: 'b' });

      [
        {
          actual: isValidYardiResidentOccupant({ ...validName }),
          expected: false,
          msg: 'rejects missing "Identification"',
        },
        {
          actual: isValidYardiResidentOccupant({
            Identification: [''],
            ...validName,
          }),
          expected: false,
          msg: 'rejects missing "Identification" item',
        },
        {
          actual: isValidYardiResidentOccupant({
            Identification: [{ Status: ['test'] }],
            ...validName,
          }),
          expected: false,
          msg: 'rejects missing "IDValue" in "Identification"',
        },
        {
          actual: isValidYardiResidentOccupant({
            Identification: [{ IDValue: [] }],
            ...validName,
          }),
          expected: false,
          msg: 'rejects missing "IDValue" value',
        },
        {
          actual: isValidYardiResidentOccupant({
            Identification: [{ IDValue: ['test'] }],
            ...validName,
          }),
          expected: true,
          msg: 'Accepts valid id value',
        },
      ].forEach(({ actual, expected, msg }) => {
        expect(actual).to.equal(expected, msg);
      });
    });

    it('rejects unusable name', () => {
      const validId = createCustomer({ id: 'a' });

      [
        {
          actual: isValidYardiResidentOccupant({ ...validId }),
          expected: false,
          msg: 'rejects missing "Name"',
        },
        {
          actual: isValidYardiResidentOccupant({
            Name: [''],
            ...validId,
          }),
          expected: false,
          msg: 'rejects missing "Name" item',
        },
        {
          actual: isValidYardiResidentOccupant({
            Name: [{ FirstName: '' }],
            ...validId,
          }),
          expected: false,
          msg: 'rejects missing "FirstName" in "Name"',
        },
        {
          actual: isValidYardiResidentOccupant({
            Name: [{ FirstName: [''] }],
            ...validId,
          }),
          expected: false,
          msg: 'rejects missing "FirstName" value',
        },
        {
          actual: isValidYardiResidentOccupant({
            Name: [{ FirstName: ['first'] }],
            ...validId,
          }),
          expected: true,
          msg: 'Accepts valid first name value',
        },
        {
          actual: isValidYardiResidentOccupant({
            Name: [{ LastName: ['last'] }],
            ...validId,
          }),
          expected: true,
          msg: 'Accepts valid last name value',
        },
        {
          actual: isValidYardiResidentOccupant({
            Name: [{ MiddleName: ['middle'] }],
            ...validId,
          }),
          expected: true,
          msg: 'Accepts valid middle name value',
        },
      ].forEach(({ actual, expected, msg }) => {
        expect(actual).to.equal(expected, msg);
      });
    });
  });

  describe('Resident Creation', () => {
    it('applies an identifier to the resident', () => {
      const expected = 'test';
      const customer = createCustomer({ id: expected, firstName: 'a' });
      const { id: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a status to the resident', () => {
      const expected = 'test';
      const customer = createCustomer({ id: '1', status: expected });
      const { status: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a yardi status to the resident', () => {
      const expected = 'test';
      const customer = createCustomer({ id: '1', yardiStatus: expected });
      const { yardiStatus: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies all names to the resident', () => {
      const expected = 'a b c';
      const customer = createCustomer({
        id: '1',
        firstName: 'a',
        middleName: 'b',
        lastName: 'c',
      });
      const result = createResidentFromYardiCustomer(customer);
      const actual = `${result.firstName} ${result.middleName} ${result.lastName}`;
      expect(actual).to.equal(expected);
    });

    it('applies an email to the resident', () => {
      const expected = 'test@gmail.com';
      const customer = createCustomer({ id: '1', email: expected });
      const { email: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a lease unit id to the resident', () => {
      const expected = '1020';
      const customer = createCustomer({ id: '1', leaseUnit: expected });
      const { leaseUnit: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a lease square footage to the resident', () => {
      const expected = '999.99';
      const customer = createCustomer({
        id: '1',
        leaseSqFt: `${expected}0000`, // test extra zeros are truncated
      });
      const { leaseSqFt: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a lease from date to the resident', () => {
      const expected = '2019-07-01T00:00:00';
      const customer = createCustomer({
        id: '1',
        leaseFrom: expected,
      });
      const { leaseFrom: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a lease to date to the resident', () => {
      const expected = '2019-07-01T00:00:00';
      const customer = createCustomer({
        id: '1',
        leaseTo: expected,
      });
      const { leaseTo: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a move in date to the resident', () => {
      const expected = '2019-07-01T00:00:00';
      const customer = createCustomer({
        id: '1',
        moveIn: expected,
      });
      const { moveIn: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies an office number to the resident', () => {
      const expected = '1234567890';
      const customer = createCustomer({
        id: '1',
        officeNumber: expected,
      });
      const { officeNumber: actual } = createResidentFromYardiCustomer(
        customer
      );
      expect(actual).to.equal(expected);
    });

    it('applies a home number to the resident', () => {
      const expected = '1234567890';
      const customer = createCustomer({
        id: '1',
        homeNumber: expected,
      });
      const { homeNumber: actual } = createResidentFromYardiCustomer(customer);
      expect(actual).to.equal(expected);
    });

    it('applies a mobile number to the resident', () => {
      const expected = '1234567890';
      const customer = createCustomer({
        id: '1',
        mobileNumber: expected,
      });
      const { mobileNumber: actual } = createResidentFromYardiCustomer(
        customer
      );
      expect(actual).to.equal(expected);
    });
  });

  describe('Occupant Creation', () => {
    it('applies an identifier to the occupant', () => {
      const expected = 'test';
      const occupant = createOccupant({ id: expected });
      const { id: actual } = createOccupantFromYardiOccupant('1', occupant);
      expect(actual).to.equal(expected);
    });

    it('applies an resident relationship to the occupant', () => {
      const expected = 'test';
      const occupant = createOccupant({ id: '1' });
      const { resident: actual } = createOccupantFromYardiOccupant(
        expected,
        occupant
      );
      expect(actual).to.equal(expected);
    });

    it('applies a relationship to the occupant', () => {
      const expected = 'test';
      const occupant = createOccupant({ id: '2', relationship: expected });
      const { relationship: actual } = createOccupantFromYardiOccupant(
        '1',
        occupant
      );
      expect(actual).to.equal(expected);
    });

    it('determines if occupant is responsible for the lease', () => {
      const expected = true;
      const occupant = createOccupant({ id: '2', responsibleForLease: 'True' }); // test real API value converted to boolean
      const { responsibleForLease: actual } = createOccupantFromYardiOccupant(
        '1',
        occupant
      );
      expect(actual).to.equal(expected);
    });

    it('applies all names to the resident', () => {
      const expected = 'a b c';
      const occupant = createOccupant({
        id: '2',
        firstName: 'a',
        middleName: 'b',
        lastName: 'c',
      });
      const result = createOccupantFromYardiOccupant('1', occupant);
      const actual = `${result.firstName} ${result.middleName} ${result.lastName}`;
      expect(actual).to.equal(expected);
    });

    it('applies an email to the resident', () => {
      const expected = 'test@gmail.com';
      const occupant = createOccupant({ id: '1', email: expected });
      const { email: actual } = createOccupantFromYardiOccupant('1', occupant);
      expect(actual).to.equal(expected);
    });

    it('applies an office number to the resident', () => {
      const expected = '1234567890';
      const occupant = createOccupant({
        id: '1',
        officeNumber: expected,
      });
      const { officeNumber: actual } = createOccupantFromYardiOccupant(
        '1',
        occupant
      );
      expect(actual).to.equal(expected);
    });

    it('applies a home number to the resident', () => {
      const expected = '1234567890';
      const occupant = createOccupant({
        id: '1',
        homeNumber: expected,
      });
      const { homeNumber: actual } = createOccupantFromYardiOccupant(
        '1',
        occupant
      );
      expect(actual).to.equal(expected);
    });

    it('applies a mobile number to the resident', () => {
      const expected = '1234567890';
      const occupant = createOccupant({
        id: '1',
        mobileNumber: expected,
      });
      const { mobileNumber: actual } = createOccupantFromYardiOccupant(
        '1',
        occupant
      );
      expect(actual).to.equal(expected);
    });
  });

  describe('Work Order Validation & Creation', () => {
    it('rejects when required attributes can not be found', () => {
      const invalidReqId = createWorkOrder({});
      delete invalidReqId.ServiceRequestId;

      const invalidId = createWorkOrder({});
      delete invalidId.ServiceRequestId[0];

      const invalidTenant = createWorkOrder({});
      delete invalidTenant.TenantCode;

      const invalidUnit = createWorkOrder({});
      delete invalidUnit.UnitCode;

      [
        {
          actual: isValidYardiWorkOrder(invalidReqId),
          expected: false,
          msg: 'rejects missing "ServiceRequestId"',
        },
        {
          actual: isValidYardiWorkOrder(invalidId),
          expected: false,
          msg: 'rejects empty "ServiceRequestId"',
        },
        {
          actual: isValidYardiWorkOrder(invalidTenant),
          expected: false,
          msg: 'rejects missing tenant/resident reference',
        },
        {
          actual: isValidYardiWorkOrder(invalidUnit),
          expected: false,
          msg: 'rejects missing "UnitCode"',
        },
      ].forEach(({ actual, expected, msg }) => {
        expect(actual).to.equal(expected, msg);
      });
    });

    it('copies over all yardi values', () => {
      [
        {
          actual: createWorkOrderFromYardi(createWorkOrder({ id: 'abc' })).id,
          expected: 'abc',
          msg: 'Copies over id',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ status: 'Progress' })
          ).status,
          expected: 'progress',
          msg: 'Copies over status',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ category: 'Misc' })
          ).category,
          expected: 'misc',
          msg: 'Copies over category',
        },
        {
          actual: createWorkOrderFromYardi(createWorkOrder({ origin: 'OL' }))
            .origin,
          expected: 'OL',
          msg: 'Copies over origin',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ priority: 'High' })
          ).priority,
          expected: 'high',
          msg: 'Copies over priority',
        },
        {
          actual: createWorkOrderFromYardi(createWorkOrder({ unit: '01-0123' }))
            .unit,
          expected: '01-0123',
          msg: 'Copies over unit',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ resident: '10123' })
          ).resident,
          expected: '10123',
          msg: 'Copies over resident',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ updatedBy: 'Testor' })
          ).updatedBy,
          expected: 'Testor',
          msg: 'Copies over updated by',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ requestDate: '2020-01-01' })
          ).requestDate,
          expected: '2020-01-01',
          msg: 'Copies over request date',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ permissionToEnter: 'True' })
          ).permissionToEnter,
          expected: true,
          msg: 'Copies over permission to enter',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ tenantCaused: 'False' })
          ).tenantCaused,
          expected: false,
          msg: 'Copies over tenant caused',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ technicianNotes: 'Notes' })
          ).technicianNotes,
          expected: 'Notes',
          msg: 'Copies over tenant caused',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ description: 'Desc' })
          ).description,
          expected: 'Desc',
          msg: 'Copies over description',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ problemNotes: 'Notes' })
          ).problemNotes,
          expected: 'Notes',
          msg: 'Copies over problem notes',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ requestorName: 'Bob Smith' })
          ).requestorName,
          expected: 'Bob Smith',
          msg: 'Copies over requestors name',
        },
        {
          actual: createWorkOrderFromYardi(
            createWorkOrder({ requestorEmail: 'test@gmail.com' })
          ).requestorEmail,
          expected: 'test@gmail.com',
          msg: 'Copies over requestors email',
        },
      ].forEach(({ actual, expected, msg }) => {
        expect(actual).to.equal(expected, msg);
      });
    });

    it('parses a requestors number', () => {
      const expected = '1234567890';
      const workOrder = createWorkOrder({ requestorPhone: '(123) 456-7890' });
      const { requestorPhone: actual } = createWorkOrderFromYardi(workOrder);
      expect(actual).to.equal(expected);
    });

    it('parses an updated at timestamp to unix', () => {
      const expected = 1584638500;
      const workOrder = createWorkOrder({ updatedAt: '2020-03-19T17:21:40' });
      const { updatedAt: actual } = createWorkOrderFromYardi(workOrder);
      expect(actual).to.equal(expected);
    });

    it('parses a created at timestamp to unix', () => {
      const expected = 1584638500;
      const workOrder = createWorkOrder({ createdAt: '2020-03-19T17:21:40' });
      const { createdAt: actual } = createWorkOrderFromYardi(workOrder);
      expect(actual).to.equal(expected);
    });
  });

  describe('Phone Numbers', () => {
    it('removes all formatting from phone numbers', () => {
      [
        {
          actual: getYardiPhoneNumbers(
            createPhone({ officeNumber: '+15122588965' }).Phone[0]
          ).officeNumber,
          expected: '15122588965',
          msg: 'removed international symbol',
        },
        {
          actual: getYardiPhoneNumbers(
            createPhone({ homeNumber: '(512)2588965' }).Phone[0]
          ).homeNumber,
          expected: '5122588965',
          msg: 'removed parenthesis',
        },
        {
          actual: getYardiPhoneNumbers(
            createPhone({ mobileNumber: '512 258-8965' }).Phone[0]
          ).mobileNumber,
          expected: '5122588965',
          msg: 'removed spacing and dashes',
        },
      ].forEach(({ actual, expected, msg }) => {
        expect(actual).to.equal(expected, msg);
      });
    });

    it('uses a duplicate office number as home number', () => {
      const expected = '5122588965';
      const { homeNumber: actual, officeNumber } = getYardiPhoneNumbers(
        createPhone({ officeNumber: expected, homeNumber: expected }).Phone[0]
      );

      expect(actual).to.equal(expected, 'set home number');
      expect(officeNumber).to.equal(undefined, 'did not set office number');
    });

    it('uses a duplicate office/home number as mobile number', () => {
      const expected = '5122588965';
      const {
        mobileNumber: actual,
        homeNumber,
        officeNumber,
      } = getYardiPhoneNumbers(
        createPhone({
          mobileNumber: expected,
          officeNumber: expected,
          homeNumber: expected,
        }).Phone[0]
      );

      expect(actual).to.equal(expected, 'set mobile number');
      expect(homeNumber).to.equal(undefined, 'did not set home number');
      expect(officeNumber).to.equal(undefined, 'did not set office number');
    });
  });
});

function createCustomer({
  id,
  status,
  yardiStatus,
  firstName,
  middleName,
  lastName,
  email,
  leaseUnit,
  leaseSqFt,
  leaseFrom,
  leaseTo,
  moveIn,
  officeNumber,
  homeNumber,
  mobileNumber,
}) {
  const result = {};

  if (id || status || yardiStatus) {
    const identification = {};
    result.Identification = [identification];
    if (id) identification.IDValue = [id];
    if (status) identification.Status = [status];
    if (yardiStatus) identification.YardiStatus = [yardiStatus];
  }

  if (firstName || middleName || lastName) {
    const name = {};
    result.Name = [name];
    if (firstName) name.FirstName = [firstName];
    if (middleName) name.MiddleName = [middleName];
    if (lastName) name.LastName = [lastName];
  }

  if (email) {
    const address = {};
    result.Address = [address];
    address.Email = [email];
  }

  if (leaseUnit || leaseSqFt || leaseFrom || leaseTo || moveIn) {
    const lease = {};
    result.Lease = [lease];
    if (leaseUnit) lease.Identification = [{ IDValue: [leaseUnit] }];
    if (leaseSqFt) lease.UnitSqFt = [leaseSqFt];
    if (leaseFrom) lease.LeaseFromDate = [leaseFrom];
    if (leaseTo) lease.LeaseToDate = [leaseTo];
    if (moveIn) lease.ActualMoveIn = [moveIn];
  }

  if (officeNumber || homeNumber || mobileNumber) {
    const phone = {};
    result.Phone = [phone];
    if (officeNumber) phone.OfficeNumber = [officeNumber];
    if (homeNumber) phone.HomeNumber = [homeNumber];
    if (mobileNumber) phone.MobileNumber = [mobileNumber];
  }

  return result;
}

function createOccupant({
  id,
  relationship,
  responsibleForLease,
  firstName,
  middleName,
  lastName,
  email,
  officeNumber,
  homeNumber,
  mobileNumber,
}) {
  const result = {};

  if (id || relationship) {
    const identification = {};
    result.Identification = [identification];
    if (id) identification.IDValue = [id];
    if (relationship) identification.Relationship = [relationship];
  }

  if (responsibleForLease || typeof responsibleForLease === 'boolean') {
    result.ResponsibleForLease = [responsibleForLease];
  }

  if (firstName || middleName || lastName) {
    const name = {};
    result.Name = [name];
    if (firstName) name.FirstName = [firstName];
    if (middleName) name.MiddleName = [middleName];
    if (lastName) name.LastName = [lastName];
  }

  if (email) {
    const address = {};
    result.Address = [address];
    address.Email = [email];
  }

  if (officeNumber || homeNumber || mobileNumber) {
    const phone = {};
    result.Phone = [phone];
    if (officeNumber) phone.OfficeNumber = [officeNumber];
    if (homeNumber) phone.HomeNumber = [homeNumber];
    if (mobileNumber) phone.MobileNumber = [mobileNumber];
  }

  return result;
}

function createWorkOrder({
  id,
  status,
  category,
  origin,
  priority,
  unit,
  resident,
  updatedAt,
  createdAt,
  updatedBy,
  requestDate,
  permissionToEnter,
  tenantCaused,
  technicianNotes,
  description,
  problemNotes,
  requestorName,
  requestorPhone,
  requestorEmail,
}) {
  const result = {};

  result.ServiceRequestId = [id || '123902'];
  result.Origin = [origin || 'OL'];
  result.CurrentStatus = [status || 'In Progress'];
  result.UnitCode = [unit || '1234'];
  result.TenantCode = [resident || `t0123112`];
  result.Priority = [priority || 'High'];
  result.Category = [category || 'Miscellaneous'];
  result.HasPermissionToEnter = [`${permissionToEnter || false}`];
  result.ServiceRequestFullDescription = [description || 'desc!'];
  result.ProblemDescriptionNotes = [problemNotes || 'notes!'];
  result.TechnicianNotes = [technicianNotes || 'notes'];
  result.TenantCaused = [`${tenantCaused || false}`];
  result.RequestorName = [requestorName || 'Bob Smith'];
  result.RequestorPhoneNumber = [requestorPhone || '1234567890'];
  result.RequestorEmail = [requestorEmail || 'test@email.com'];
  result.ServiceRequestDate = [requestDate || '2020-01-01'];
  result.UpdatedBy = [updatedBy || 'Bob Smith II'];

  if (updatedAt && typeof updatedAt === 'number') {
    const updateIso = new Date(updatedAt).toISOString().replace(/Z$/, '');
    result.UpdateDate = [updateIso];
  } else {
    result.UpdateDate = ['2020-03-19T17:21:40'];
  }

  result.StatusHistory = [
    {
      Status: [
        {
          $: {
            Type: '',
            TimeStamp: '2020-03-19T17:21:40',
          },
        },
        {
          $: {
            Type: status || 'In Progress',
            TimeStamp: '2020-03-19T17:21:40',
          },
        },
      ],
    },
  ];

  if (createdAt && typeof createdAt === 'number') {
    const createdIso = new Date(updatedAt).toISOString().replace(/Z$/, '');
    result.StatusHistory[0].Status[0].$.TimeStamp = createdIso;
  }

  return result;
}

function createPhone({ officeNumber, homeNumber, mobileNumber }) {
  const result = {};
  const phone = {};
  result.Phone = [phone];
  if (officeNumber) phone.OfficeNumber = [officeNumber];
  if (homeNumber) phone.HomeNumber = [homeNumber];
  if (mobileNumber) phone.MobileNumber = [mobileNumber];
  return result;
}
