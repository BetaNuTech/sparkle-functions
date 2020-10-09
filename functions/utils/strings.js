module.exports = {
  /**
   * Convert a string: Into A Title
   * @param  {String} str input
   * @return {String} - str transformed
   */
  capitalize(str) {
    return `${str}`
      .toLowerCase()
      .split(' ')
      .map(s => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)
      .join(' ');
  },
};
