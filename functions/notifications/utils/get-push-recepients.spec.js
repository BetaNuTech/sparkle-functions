const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const getRecepients = require('./get-push-recepients');

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
};

describe('Push Messages | Utils | Get Recepients', () => {
  it('should add all admin users as recepients', () => {
    const users = [USERS.admin, USERS.corporate, USERS.property];
    const expected = [USERS.admin.id];
    const actual = getRecepients({ users });
    expect(actual).to.deep.equal(expected);
  });

  it('should add all corporate users when permitted', () => {
    const users = [USERS.admin, USERS.corporate, USERS.property];
    const expected = [USERS.admin.id, USERS.corporate.id];
    const actual = getRecepients({ users, allowCorp: true });
    expect(actual).to.deep.equal(expected);
  });

  it('should add all property level users matching a property', () => {
    const users = [USERS.admin, USERS.corporate, USERS.property];
    const expected = [USERS.admin.id, USERS.property.id];
    const actual = getRecepients({ users, property: PROPERTY_ID });
    expect(actual).to.deep.equal(expected);
  });

  it('should remove all users in excluded', () => {
    const users = [USERS.admin, USERS.corporate, USERS.property];
    const expected = [];
    const actual = getRecepients({ users, excludes: [USERS.admin.id] });
    expect(actual).to.deep.equal(expected);
  });
});
