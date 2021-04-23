const { expect } = require('chai');
const validate = require('./validate-deficient-item-update');
const config = require('../../config');

describe('Deficient Items | Utils | Validate Deficient Item Update', function() {
  it('ignores updates not provided in schema', () => {
    const expected = [];
    const actual = validate({
      progressNotes: {
        '1': {
          startDate: 1,
          progressNote: 'note',
          user: '2',
          createdAt: 2,
        },
      },
    });

    expect(actual).to.deep.equal(expected);
  });

  it('rejects invalid updates', () => {
    const data = [
      {
        deficiency: { currentStartDate: 'date' },
        expected: 'currentStartDate',
        msg: 'rejects non-number for current start date',
      },
      {
        deficiency: { currentDueDate: 'date' },
        expected: 'currentDueDate',
        msg: 'rejects non-number for current due date',
      },
      {
        deficiency: { currentDueDateDay: true },
        expected: 'currentDueDateDay',
        msg: 'rejects non-string for current due date day',
      },
      {
        deficiency: { state: 1 },
        expected: 'state',
        msg: 'rejects non-string for state',
      },
      {
        deficiency: { state: 'non-enumerable' },
        expected: 'state',
        msg: 'rejects non-enumerable for state',
      },
      {
        deficiency: { currentPlanToFix: 4 },
        expected: 'currentPlanToFix',
        msg: 'rejects non-string for current plan to fix',
      },
      {
        deficiency: { currentResponsibilityGroup: 1 },
        expected: 'currentResponsibilityGroup',
        msg: 'rejects non-string for current responsibility group',
      },
      {
        deficiency: { currentResponsibilityGroup: 'non-enumerable' },
        expected: 'currentResponsibilityGroup',
        msg: 'rejects non-enumerable for current responsibility group',
      },
      {
        deficiency: { progressNote: 4 },
        expected: 'progressNote',
        msg: 'rejects non-string for progress note',
      },
      {
        deficiency: { currentDeferredDate: 'date' },
        expected: 'currentDeferredDate',
        msg: 'rejects non-number for current deferred date',
      },
      {
        deficiency: { currentDeferredDateDay: 1 },
        expected: 'currentDeferredDateDay',
        msg: 'rejects non-string for current deferred date day',
      },
      {
        deficiency: { currentReasonIncomplete: 4 },
        expected: 'currentReasonIncomplete',
        msg: 'rejects non-string for current reason incomplete',
      },
      {
        deficiency: { currentCompleteNowReason: 4 },
        expected: 'currentCompleteNowReason',
        msg: 'rejects non-string for current complete now reason',
      },
      {
        deficiency: { isDuplicate: 4 },
        expected: 'isDuplicate',
        msg: 'rejects non-boolean for is duplicate',
      },
      {
        deficiency: { willRequireProgressNote: 4 },
        expected: 'willRequireProgressNote',
        msg: 'rejects non-boolean for will require progress note',
      },
    ];

    for (let i = 0; i < data.length; i++) {
      const { deficiency, expected, msg } = data[i];
      const result = validate(deficiency);
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });

  it('accpets a valid update', () => {
    const expected = [];
    const unixTime = Math.round(Date.now() / 1000);
    const actual = validate({
      currentStartDate: unixTime,
      currentDueDat: unixTime,
      currentDueDateDay: '1/2/2025',
      state: config.deficientItems.allStates[0],
      currentPlanToFix: 'fix',
      currentResponsibilityGroup: config.deficientItems.responsibilityGroups[0],
      progressNote: 'note',
      currentDeferredDate: unixTime,
      currentReasonIncomplete: 'oops',
      currentDeferredDate: unixTime,
      currentDeferredDateDay: '1/2/2025',
      currentCompleteNowReason: 'done',
      isDuplicate: true,
      willRequireProgressNote: false,
    });

    expect(actual).to.deep.equal(expected);
  });
});
