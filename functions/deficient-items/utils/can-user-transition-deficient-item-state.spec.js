const { expect } = require('chai');
const util = require('./can-user-transition-deficient-item-state');
const config = require('../../config/deficient-items');
const mocking = require('../../test-helpers/mocking');

const DI_ENUM_STATES = config.allStates;
const PREMISSIONED_TRANSITIONS = config.permissionedTransitionStates;
const users = [
  mocking.createUser({ admin: true, corporate: false }),
  mocking.createUser({ corporate: true, admin: false }),
  mocking.createUser({
    properties: { a: true },
    corporate: false,
    admin: false,
  }),
];

describe('Deficient Items | Utils | Can User Transition Deficient Item State', () => {
  it('should allow any user to transition to a non-permissioned state', () => {
    const expected = users.map(() => true);
    const [nonPermissionedState] = DI_ENUM_STATES.filter(
      state => !PREMISSIONED_TRANSITIONS.includes(state)
    );

    const actual = [];
    for (let i = 0; i < users.length; i++) {
      actual.push(util(users[i], nonPermissionedState));
    }

    expect(actual).to.deep.equal(expected);
  });

  it('should only allow corporate/admin users to transition to a permissioned state', () => {
    const expected = {
      admin: PREMISSIONED_TRANSITIONS.map(() => true),
      corporate: PREMISSIONED_TRANSITIONS.map(() => true),
      propertyLevel: PREMISSIONED_TRANSITIONS.map(() => false),
    };

    const actual = { admin: [], corporate: [], propertyLevel: [] };
    for (let i = 0; i < PREMISSIONED_TRANSITIONS.length; i++) {
      const state = PREMISSIONED_TRANSITIONS[i];

      for (let k = 0; k < users.length; k++) {
        const user = users[k];
        let testSet = [];

        if (user.admin) {
          testSet = actual.admin;
        } else if (user.corporate) {
          testSet = actual.corporate;
        } else {
          testSet = actual.propertyLevel;
        }

        testSet.push(util(user, state));
      }
    }

    expect(actual).to.deep.equal(expected);
  });
});
