const { expect } = require('chai');
const isOverdue = require('./is-inspection-overdue');

const NOW_UNIX = Math.round(Date.now() / 1000);
const UNIX_DAY = 86400; // Seconds in day
const CURRENT_DAY = NOW_UNIX / UNIX_DAY;
const ONE_DAY_AGO = CURRENT_DAY - 1;
const TWO_DAYS_AGO = CURRENT_DAY - 2;
const THREE_DAYS_AGO = CURRENT_DAY - 3;
const FOUR_DAYS_AGO = CURRENT_DAY - 4;
const FIVE_DAYS_AGO = CURRENT_DAY - 5;
const SIX_DAYS_AGO = CURRENT_DAY - 6;
const SEVEN_DAYS_AGO = CURRENT_DAY - 7;
const EIGHT_DAYS_AGO = CURRENT_DAY - 8;
const NINE_DAYS_AGO = CURRENT_DAY - 9;
const TEN_DAYS_AGO = CURRENT_DAY - 10;
const ELEVEN_DAYS_AGO = CURRENT_DAY - 11;
const TWELVE_DAYS_AGO = CURRENT_DAY - 11;

describe('Inspections | API | Utils | Is Overdue', () => {
  it('should only be overdue if completed over 3 days ago and created over 10 days ago', () => {
    [
      {
        actual: isOverdue(CURRENT_DAY, ELEVEN_DAYS_AGO, CURRENT_DAY),
        expected: false,
        msg: 'completed only today',
      },
      {
        actual: isOverdue(CURRENT_DAY, ELEVEN_DAYS_AGO, ONE_DAY_AGO),
        expected: false,
        msg: 'completed only yesturday',
      },
      {
        actual: isOverdue(CURRENT_DAY, ELEVEN_DAYS_AGO, TWO_DAYS_AGO),
        expected: false,
        msg: 'completed only 2 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, ELEVEN_DAYS_AGO, THREE_DAYS_AGO),
        expected: false,
        msg: 'completed only 3 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, FOUR_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 4 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, FIVE_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 5 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, SIX_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 6 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, SEVEN_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 7 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, EIGHT_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 8 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, NINE_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 9 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, TEN_DAYS_AGO, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created 10 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, ELEVEN_DAYS_AGO, FOUR_DAYS_AGO),
        expected: true,
        msg: 'created 11 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, TWELVE_DAYS_AGO, FOUR_DAYS_AGO),
        expected: true,
        msg: 'created 12 days ago',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
