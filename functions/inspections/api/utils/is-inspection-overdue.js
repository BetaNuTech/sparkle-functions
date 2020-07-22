const assert = require('assert');

/**
 * Check if inspection was created over 10
 * days since a comparision date
 * @param  {Number} compareDaysSinceEpoche - Days since UNIX Epoch
 * @param  {Number} creationDaysSinceEpoche - Days since UNIX Epoch
 * @return {Boolean}
 */
module.exports = function isInspectionOverdue(
  compareDaysSinceEpoche,
  creationDaysSinceEpoche
) {
  assert(
    compareDaysSinceEpoche &&
      typeof compareDaysSinceEpoche === 'number' &&
      compareDaysSinceEpoche === compareDaysSinceEpoche,
    'has valid compare day'
  );
  assert(
    creationDaysSinceEpoche &&
      typeof creationDaysSinceEpoche === 'number' &&
      creationDaysSinceEpoche === creationDaysSinceEpoche,
    'has valid creation day'
  );
  const daysSinceCreation = compareDaysSinceEpoche - creationDaysSinceEpoche;
  return daysSinceCreation > 10;
};
