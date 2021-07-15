const { expect } = require('chai');
const { deficientItems } = require('../../config');
const mocking = require('../../test-helpers/mocking');
const update = require('./update-deficient-items-attrs');

const ALL_STATES = deficientItems.allStates;
const REQUIRED_ACTIONS_VALUES = deficientItems.requiredActionStates;
const FOLLOW_UP_ACTION_VALUES = deficientItems.followUpActionStates;
const EXCLUDED_DI_COUNTER_VALUES =
  deficientItems.excludedPropertyNumOfDeficientItemsStates;
const OVERDUE_DI_COUNTER_VALUES = deficientItems.overdueCounterStates;

describe('Properties | Utils | Update Deficient Items Attrs', () => {
  it('counts the total number of inspections deficient items', () => {
    [
      {
        actual: update(createConfig([''])).updates.numOfDeficientItems,
        expected: 1,
        msg: 'found 1 for 1 inspections with 1',
      },
      {
        actual: update(createConfig([''], [''])).updates.numOfDeficientItems,
        expected: 2,
        msg: 'found 2 for 2 inspections with 1 each',
      },
      {
        actual: update(createConfig(['', ''])).updates.numOfDeficientItems,
        expected: 2,
        msg: 'found 2 for 1 inspections with 2',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).equal(expected, msg);
    });
  });

  it('does not count excluded deficient item states in total', () => {
    const [countedState] = ALL_STATES.filter(
      s => !EXCLUDED_DI_COUNTER_VALUES.includes(s)
    );
    const nonCountedStates = EXCLUDED_DI_COUNTER_VALUES;

    [
      {
        actual: update(createConfig([countedState, nonCountedStates[0]]))
          .updates.numOfDeficientItems,
        expected: 1,
        msg: 'found 1 & ignored 1 for 1 inspection with 2 DI',
      },
      {
        actual: update(
          createConfig([countedState, countedState, nonCountedStates[0]])
        ).updates.numOfDeficientItems,
        expected: 2,
        msg: 'found 2 & ignored 1 for 1 inspection with 3 DI',
      },
      {
        actual: update(createConfig([countedState], [...nonCountedStates]))
          .updates.numOfDeficientItems,
        expected: 1,
        msg: `found 1 & ignored ${
          nonCountedStates.length
        } for 2 inspections with ${nonCountedStates.length + 1} DI`,
      },
      {
        actual: update(
          createConfig(
            ['completed', 'requires-action'],
            [
              'requires-action',
              'requires-action',
              'deferred',
              'requires-action',
              'requires-action',
            ],
            ['deferred', nonCountedStates[0]]
          )
        ).updates.numOfDeficientItems,
        expected: 8,
        msg: `found 8 & ignored 1 for 3 inspections with 9 DI`,
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).equal(expected, msg);
    });
  });

  it('counts deficient items requiring an action', () => {
    const reqActStates = REQUIRED_ACTIONS_VALUES;
    const nonReqActStates = ALL_STATES.filter(
      s => !REQUIRED_ACTIONS_VALUES.includes(s)
    );

    [
      {
        actual: update(createConfig([reqActStates[0], nonReqActStates[0]]))
          .updates.numOfRequiredActionsForDeficientItems,
        expected: 1,
        msg: 'found 1 & ignored 1 for 1 inspection with 2 DI',
      },
      {
        actual: update(
          createConfig([reqActStates[0], reqActStates[0], nonReqActStates[0]])
        ).updates.numOfRequiredActionsForDeficientItems,
        expected: 2,
        msg: 'found 2 & ignored 1 for 1 inspection with 3 DI',
      },
      {
        actual: update(
          createConfig([reqActStates[0]], [...nonReqActStates, reqActStates[0]])
        ).updates.numOfRequiredActionsForDeficientItems,
        expected: 2,
        msg: `found 2 & ignored ${
          nonReqActStates.length
        } for 2 inspections with ${nonReqActStates.length + 2} DI`,
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).equal(expected, msg);
    });
  });

  it('counts deficient items requiring follow up', () => {
    const folUpStates = FOLLOW_UP_ACTION_VALUES;
    const nonfolUpStates = ALL_STATES.filter(
      s => !FOLLOW_UP_ACTION_VALUES.includes(s)
    );

    [
      {
        actual: update(createConfig([folUpStates[0], nonfolUpStates[0]]))
          .updates.numOfFollowUpActionsForDeficientItems,
        expected: 1,
        msg: 'found 1 & ignored 1 for 1 inspection with 2 DI',
      },
      {
        actual: update(
          createConfig([folUpStates[0], folUpStates[0], nonfolUpStates[0]])
        ).updates.numOfFollowUpActionsForDeficientItems,
        expected: 2,
        msg: 'found 2 & ignored 1 for 1 inspection with 3 DI',
      },
      {
        actual: update(
          createConfig([folUpStates[0]], [...nonfolUpStates, folUpStates[0]])
        ).updates.numOfFollowUpActionsForDeficientItems,
        expected: 2,
        msg: `found 2 & ignored ${
          nonfolUpStates.length
        } for 2 inspections with ${nonfolUpStates.length + 2} DI`,
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).equal(expected, msg);
    });
  });

  it('counts the total number of overdue deficient items', () => {
    const overdueStates = OVERDUE_DI_COUNTER_VALUES;
    const nonOverdueStates = ALL_STATES.filter(
      s => !OVERDUE_DI_COUNTER_VALUES.includes(s)
    );

    [
      {
        actual: update(createConfig([overdueStates[0], nonOverdueStates[0]]))
          .updates.numOfOverdueDeficientItems,
        expected: 1,
        msg: 'found 1 & ignored 1 for 1 inspection with 2 DI',
      },
      {
        actual: update(
          createConfig([
            overdueStates[0],
            overdueStates[0],
            nonOverdueStates[0],
          ])
        ).updates.numOfOverdueDeficientItems,
        expected: 2,
        msg: 'found 2 & ignored 1 for 1 inspection with 3 DI',
      },
      {
        actual: update(
          createConfig(
            [overdueStates[0]],
            [...nonOverdueStates, overdueStates[0]]
          )
        ).updates.numOfOverdueDeficientItems,
        expected: 2,
        msg: `found 2 & ignored ${
          nonOverdueStates.length
        } for 2 inspections with ${nonOverdueStates.length + 2} DI`,
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).equal(expected, msg);
    });
  });
});

const uuid = (() => {
  let i = 0;
  return () => `-${++i}`;
})();

function createConfig(...deficientGroups) {
  const result = {
    propertyId: uuid(),
    inspections: [],
    deficientItems: [],
    updates: {},
  };

  deficientGroups.forEach(deficiencies => {
    const items = {};
    const inspectionId = uuid();

    // Add dificient item
    // for each deficiency
    deficiencies.forEach(defItemState => {
      const itemId = uuid();
      items[itemId] = mocking.createCompletedMainInputItem(
        'twoactions_checkmarkx',
        true
      );

      // Allow empty string for
      // new (uncreated) deficient items
      if (defItemState) {
        result.deficientItems.push(
          // Add existing deficient item with requested state
          mocking.createDeficientItem(inspectionId, itemId, {
            state: defItemState,
          })
        );
      }
    });

    // Create a trackable inspection
    // for each deficiency group
    result.inspections.push(
      mocking.createInspection({
        id: inspectionId,
        property: result.propertyId,
        inspectionCompleted: true,
        template: {
          trackDeficientItems: true,
          items,
        },
      })
    );
  });

  return result;
}