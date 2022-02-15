const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const configureNotifications = require('./configure-notifications');

describe('Deficient Items | Utils | Configure Notifications', () => {
  it('publishes a progress note update notification', () => {
    const expected =
      'Progress Note just added to Deficient Item Title by Mr Testor (email@test.com)';
    const user = mocking.createUser({
      id: uuid(),
      firstName: 'mr',
      lastName: 'testor',
      email: 'email@test.com',
    });
    const propertyId = uuid();
    const property = mocking.createProperty({ id: propertyId });
    const deficiency = mocking.createDeficiency({
      state: 'pending',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
      itemTitle: 'Title',
    });

    const notification = configureNotifications.createProgressNote(
      'note',
      user,
      property,
      deficiency
    );

    const actual = notification ? notification.summary || '' : '';
    expect(actual).to.equal(expected);
  });

  it('configures a state change deficient item update notification', () => {
    const expected =
      'Deficient Item: Title moved from requires-action to pending by Mr Testor';
    const previousState = 'requires-action';
    const user = mocking.createUser({
      id: uuid(),
      firstName: 'mr',
      lastName: 'testor',
      email: 'email@test.com',
    });
    const propertyId = uuid();
    const property = mocking.createProperty({ id: propertyId });
    const deficiency = mocking.createDeficiency({
      state: 'pending',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
      itemTitle: 'Title',
    });

    const notification = configureNotifications.createDeficiencyUpdate(
      previousState,
      user,
      property,
      deficiency
    );

    const actual = notification ? notification.summary || '' : '';
    expect(actual).to.equal(expected);
  });

  it('publishes a regular deficient item update notification', () => {
    const expected = 'Deficient Item: Title updated by Mr Testor';
    const user = mocking.createUser({
      id: uuid(),
      firstName: 'mr',
      lastName: 'testor',
      email: 'email@test.com',
    });
    const propertyId = uuid();
    const property = mocking.createProperty({ id: propertyId });
    const deficiency = mocking.createDeficiency({
      state: 'pending',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
      itemTitle: 'Title',
    });

    const notification = configureNotifications.createDeficiencyUpdate(
      deficiency.state,
      user,
      property,
      deficiency
    );

    const actual = notification ? notification.summary || '' : '';
    expect(actual).to.equal(expected);
  });
});
