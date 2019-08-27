const moment = require('moment');

/**
 * Convert a `MM-DD-YYYY` date string to
 * an ISO 8601 formatted timestamp at midnight
 * in UTC offset
 * @param  {String} dateStr
 * @return {String}
 */
module.exports = (dateStr, utcOffset = '-05:00') => {
  const [month, date, year] = dateStr.split('/').map(str => parseInt(str, 10));
  return moment([year, month - 1, date, 0, 0, 0])
    .utcOffset(utcOffset, true)
    .toISOString();
};
