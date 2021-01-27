/**
 * Functional mixin factory
 * @param  {Function[]} fns
 * @return {Function}
 */
module.exports = (...fns) => (o, ...args) => {
  return fns.reduce((x, fn) => fn(x, ...args), o);
};
