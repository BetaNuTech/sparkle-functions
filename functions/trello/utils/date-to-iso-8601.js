const moment = require('moment');

/**
 * Convert a `MM-DD-YYYY` date string to
 * an ISO 8601 formatted timestamp
 * @param  {String} dateStr
 * @return {String}
 */
module.exports = dateStr => {
  const [month, date, year] = dateStr.split('/').map(str => parseInt(str, 10));
  return moment([year, month - 1, date]).toISOString();
};
