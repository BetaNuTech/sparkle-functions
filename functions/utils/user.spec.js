const { expect } = require('chai');
const uuid = require('../test-helpers/uuid');
const mocking = require('../test-helpers/mocking');
const user = require('./user');

const PROPERTY_ID = uuid();
const ADMIN = mocking.createUser({ admin: true });
const CORPORATE = mocking.createUser({ admin: false, corporate: true });
const PROPERTY_MANAGER = mocking.createUser({
  admin: false,
  corporate: false,
  properties: {
    [PROPERTY_ID]: true,
  },
});
const TEAM_LEAD = mocking.createUser({
  admin: false,
  corporate: false,
  teams: {
    'team-1': {
      [PROPERTY_ID]: true,
    },
  },
});
const NO_ACCESS = mocking.createUser({
  admin: false,
  corporate: false,
  teams: {},
  properties: {},
});

describe('Unit | User', () => {
  it("creates a user's full name", () => {
    const expected = 'John Smith';
    const johnSmith = JSON.parse(JSON.stringify(NO_ACCESS));
    johnSmith.firstName = 'John';
    johnSmith.lastName = 'Smith';
    const actual = user.getFullName(johnSmith);
    expect(actual).to.equal(expected);
  });

  it('gracefully handles user without a name', () => {
    const expected = '';
    const nameless = JSON.parse(JSON.stringify(NO_ACCESS));
    delete nameless.firstName;
    delete nameless.lastName;
    const actual = user.getFullName(nameless);
    expect(actual).to.equal(expected);
  });

  it('finds all a users properties', () => {
    const expected = Object.keys(PROPERTY_MANAGER.properties);
    const actual = user.getProperties(PROPERTY_MANAGER.properties);
    expect(actual).to.deep.equal(expected);
  });

  it('finds all a users team lead properties', () => {
    const expected = Object.keys(Object.values(TEAM_LEAD.teams)[0]);
    const actual = user.getLeadershipProperties(TEAM_LEAD.teams);
    expect(actual).to.deep.equal(expected);
  });

  it('finds the correct permission level name for all access levels', () => {
    const tests = [
      {
        data: ADMIN,
        expected: 'admin',
      },
      {
        data: CORPORATE,
        expected: 'corporate',
      },
      {
        data: TEAM_LEAD,
        expected: 'teamLead',
      },
      {
        data: PROPERTY_MANAGER,
        expected: 'propertyMember',
      },
      {
        data: NO_ACCESS,
        expected: 'noAccess',
      },
    ];

    for (let i = 0; i < tests.length; i += 1) {
      const { data, expected } = tests[i];
      const actual = user.getLevelName(data);
      expect(actual).to.equal(expected);
    }
  });
});
