const { lookup: zipToTZ } = require('zipcode-to-timezone');

/**
 * Lookup timezone from
 * an optional zip code
 * @param  {String?} zipCode [description]
 * @return {String}         [description]
 */
module.exports = zipCode => {
  let timezone = '';
  if (zipCode) timezone = zipToTZ(zipCode);
  if (!timezone) timezone = 'America/New_York'; // default Timezone
  return timezone;
};
