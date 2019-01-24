module.exports = (function() {
  let i = 0;
  return () => `-${++i}`;
})();
