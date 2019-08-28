const moment = require('moment-timezone');
const config = require('../../config');

const DEFAULT_TIMEZONE = config.deficientItems.defaultTimezone;

/**
 * Convert a `MM-DD-YYYY` date string to
 * an ISO 8601 formatted timestamp at midnight
 * in UTC offset
 * @param  {String} dateStr
 * @param  {String?} timezone
 * @return {String}
 */
module.exports = (dateStr, timezone = DEFAULT_TIMEZONE) => {
  const utcOffset = moment()
    .tz(timezone)
    .utcOffset();
  const [month, date, year] = dateStr.split('/').map(str => parseInt(str, 10));
  return moment([year, month - 1, date, 0, 0, 0])
    .utcOffset(utcOffset, true)
    .toISOString();
};
