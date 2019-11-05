const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const getRecepients = require('./get-push-recepients');

const TEAM_ID = uuid();
const PROPERTY_ID = uuid();
const USERS = {
  admin: {
    id: uuid(),
    admin: true,
  },
  corporate: {
    id: uuid(),
    corporate: true,
  },
  property: {
    id: uuid(),
    properties: { [PROPERTY_ID]: true },
  },
  teamLead: {
    id: uuid(),
    teams: { [TEAM_ID]: { [PROPERTY_ID]: true } },
  },
  corporateTeamLead: {
    id: uuid(),
    corporate: true,
    teams: { [TEAM_ID]: { [PROPERTY_ID]: true } },
  },
};

describe('Push Messages | Utils | Get Recepients', () => {
  it('should add all admin users as recepients', () => {
    const users = Object.values(USERS);
    const expected = [USERS.admin.id];
    const actual = getRecepients({ users });
    expect(actual).to.deep.equal(expected);
  });

  it('should add all corporate users when permitted', () => {
    const users = Object.values(USERS);
    const expected = [USERS.admin.id, USERS.corporate.id];
    const actual = getRecepients({ users, allowCorp: true });
    expect(actual).to.deep.equal(expected);
  });

  it('should add all property level users matching a property', () => {
    const users = Object.values(USERS);
    const expected = [USERS.admin.id, USERS.property.id];
    const actual = getRecepients({ users, property: PROPERTY_ID });
    expect(actual).to.deep.equal(expected);
  });

  it('should add all team lead level users associated with a property', () => {
    const users = Object.values(USERS);
    const expected = [
      USERS.admin.id,
      USERS.property.id,
      USERS.teamLead.id,
      USERS.corporateTeamLead.id,
    ];
    const actual = getRecepients({
      users,
      allowTeamLead: true,
      property: PROPERTY_ID,
    });
    expect(actual).to.deep.equal(expected);
  });

  it('should not add corporate team leads to non property notifications', () => {
    const users = Object.values(USERS);
    const expected = [USERS.admin.id, USERS.corporate.id];
    const actual = getRecepients({
      users,
      allowCorp: true,
    });
    expect(actual).to.deep.equal(expected);
  });

  it('should remove all users in excluded', () => {
    const users = Object.values(USERS);
    const expected = [];
    const actual = getRecepients({ users, excludes: [USERS.admin.id] });
    expect(actual).to.deep.equal(expected);
  });
});
