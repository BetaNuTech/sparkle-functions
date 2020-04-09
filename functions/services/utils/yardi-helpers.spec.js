const { expect } = require('chai');
const {
  isValidYardiResidentOccupant,
  createResidentFromYardiCustomer,
  createOccupantFromYardiOccupant,
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

function createPhone({ officeNumber, homeNumber, mobileNumber }) {
  const result = {};
  const phone = {};
  result.Phone = [phone];
  if (officeNumber) phone.OfficeNumber = [officeNumber];
  if (homeNumber) phone.HomeNumber = [homeNumber];
  if (mobileNumber) phone.MobileNumber = [mobileNumber];
  return result;
}
