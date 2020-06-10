/**
 * Determine if inspection is "overdue"
 * @param  {Number} currentDay - Days since UNIX Epoch
 * @param  {Number} creationDateDay - Days since UNIX Epoch
 * @param  {Number} completionDateDay - Days since UNIX Epoch
 * @return {Boolean}
 */
module.exports = function isInspectionOverdue(
  currentDay,
  creationDateDay,
  completionDateDay
) {
  let differenceDays;

  if (currentDay - completionDateDay > 3) {
    // Formula when completed more than 3 days ago
    differenceDays = currentDay - (creationDateDay + 3); // assume 3 days instead
  } else {
    // Formula when completed less than 3 days ago
    differenceDays = currentDay - completionDateDay; // days since completion
  }

  return differenceDays > 7;
};
