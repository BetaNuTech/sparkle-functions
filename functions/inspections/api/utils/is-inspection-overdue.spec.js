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
const TWELVE_DAYS_AGO = CURRENT_DAY - 12;
const THIRTEEN_DAYS_AGO = CURRENT_DAY - 13;

describe('Inspections | API | Utils | Is Overdue', () => {
  it('should be overdue if created over 10 day from a comparison day', () => {
    [
      {
        actual: isOverdue(CURRENT_DAY, CURRENT_DAY),
        expected: false,
        msg: 'created only today',
      },
      {
        actual: isOverdue(CURRENT_DAY, ONE_DAY_AGO),
        expected: false,
        msg: 'created only yesturday',
      },
      {
        actual: isOverdue(CURRENT_DAY, TWO_DAYS_AGO),
        expected: false,
        msg: 'created only 2 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, THREE_DAYS_AGO),
        expected: false,
        msg: 'created only 3 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, FOUR_DAYS_AGO),
        expected: false,
        msg: 'created only 4 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, FIVE_DAYS_AGO),
        expected: false,
        msg: 'created only 5 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, SIX_DAYS_AGO),
        expected: false,
        msg: 'created only 6 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, SEVEN_DAYS_AGO),
        expected: false,
        msg: 'created only 7 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, EIGHT_DAYS_AGO),
        expected: false,
        msg: 'created only 8 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, NINE_DAYS_AGO),
        expected: false,
        msg: 'created only 9 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, TEN_DAYS_AGO),
        expected: false,
        msg: 'created only 10 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, ELEVEN_DAYS_AGO),
        expected: true,
        msg: 'created 11 days ago',
      },
      {
        actual: isOverdue(CURRENT_DAY, TWELVE_DAYS_AGO),
        expected: true,
        msg: 'created 12 days ago',
      },
      {
        actual: isOverdue(TWO_DAYS_AGO, TWELVE_DAYS_AGO),
        expected: false,
        msg: 'created 10 days from comparison day',
      },
      {
        actual: isOverdue(TWO_DAYS_AGO, THIRTEEN_DAYS_AGO),
        expected: true,
        msg: 'created 11 days from comparison day',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
