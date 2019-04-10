const NOW_DAY = unixToUnixDays(Date.now() / 1000);

module.exports = {
  /**
   * Days since Unix Epoch
   * @type {Number}
   */
  nowDay: NOW_DAY,

  /**
   * Hash of UNIX timestamps
   * @type {Object}
   */
  age: Object.freeze({
    oneDayAgo: unixDaysToUnix(NOW_DAY - 1),
    twoDaysAgo: unixDaysToUnix(NOW_DAY - 2),
    threeDaysAgo: unixDaysToUnix(NOW_DAY - 3),
    fourDaysAgo: unixDaysToUnix(NOW_DAY - 4),
    fiveDaysAgo: unixDaysToUnix(NOW_DAY - 5),
    sixDaysAgo: unixDaysToUnix(NOW_DAY - 6),
    nineDaysAgo: unixDaysToUnix(NOW_DAY - 9),
    elevenDaysAgo: unixDaysToUnix(NOW_DAY - 11),
    fourteenDaysAgo: unixDaysToUnix(NOW_DAY - 14),
    fifteenDaysAgo: unixDaysToUnix(NOW_DAY- 15),
    twentyDaysAgo: unixDaysToUnix(NOW_DAY - 20),

    oneDayFromNow: unixDaysToUnix(NOW_DAY + 1),
    twoDaysFromNow: unixDaysToUnix(NOW_DAY + 2),
    threeDaysFromNow: unixDaysToUnix(NOW_DAY + 3),
    fourDaysFromNow: unixDaysToUnix(NOW_DAY + 4),
    fiveDaysFromNow: unixDaysToUnix(NOW_DAY + 5),
    sixDaysFromNow: unixDaysToUnix(NOW_DAY + 6)
  })
};

function unixDaysToUnix(unixDays) {
  return Math.round(unixDays * 60 * 60 * 24);
}

function unixToUnixDays(unix) {
  return unix / 60 / 60 / 24; // days since Unix Epoch
}
