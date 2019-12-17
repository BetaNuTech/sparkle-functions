const moment = require('moment-timezone');
const { lookup: zipToTZ } = require('zipcode-to-timezone');

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

  // Set timezone from
  // a optional zip code
  let timezone = '';
  if (zipCode) timezone = zipToTZ(zipCode);
  if (!timezone) timezone = 'America/New_York'; // default Timezone

  // Set to last second of provided date
  return moment
    .tz(`${year}-${month}-${date} 23:59:59`, timezone)
    .toISOString(true); // keep offset
};
