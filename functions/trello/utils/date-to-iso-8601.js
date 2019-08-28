const moment = require('moment');

/**
 * Convert a `MM-DD-YYYY` date string to
 * an ISO 8601 formatted timestamp at midnight
 * in UTC time
 * @param  {String} dateStr
 * @param  {String?} timezone
 * @return {String}
 */
module.exports = dateStr => {
  const [month, date, year] = dateStr.split('/').map(str => parseInt(str, 10));
  return moment.utc([year, month - 1, date, 23, 59, 0]).toISOString();
};
