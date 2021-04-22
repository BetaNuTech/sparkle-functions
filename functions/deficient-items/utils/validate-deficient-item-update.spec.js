const { expect } = require('chai');
const validate = require('./validate-deficient-item-update');

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
        msg: 'rejects string date',
      },
      // TODO currentDueDate
      // TODO currentDueDateDay
      // TODO currentDueDateDay
      // TODO state
      // TODO state non enum
      // TODO currentPlanToFix
      // TODO currentResponsibilityGroup
      // TODO currentResponsibilityGroup non enum
      // TODO progressNote
      // TODO currentDeferredDate
      // TODO currentReasonIncomplete
      // TODO currentDeferredDate
      // TODO currentDeferredDateDay
      // TODO currentCompleteNowReason
      // TODO isDuplicate
      // TODO willRequireProgressNote
    ];

    for (let i = 0; i < data.length; i++) {
      const { deficiency, expected, msg } = data[i];
      const result = validate(deficiency);
      const actual = result.map(err => err.path).join(',');
      expect(actual).to.equal(expected, msg);
    }
  });
});
