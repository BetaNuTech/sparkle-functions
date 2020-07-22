const moment = require('moment-timezone');
const zipToTimezone = require('../../utils/zip-to-timezone');

/**
 * Convert a `MM-DD-YYYY` date string to
 * an ISO 8601 formatted timestamp at midnight
 * in UTC time
 * @param  {String} dateStr
 * @param  {String?} zipCode
 * @return {String}
 */
module.exports = (dateStr, zipCode) => {
  const [month, date, year] = dateStr.split('/').map(str => parseInt(str, 10));
  const timezone = zipToTimezone(zipCode);

  // Set to last second of provided date
  return moment
    .tz(`${year}-${month}-${date} 23:59:59`, 'YYYY-MM-DD HH:mm:ss', timezone)
    .toISOString(true); // keep offset
};
