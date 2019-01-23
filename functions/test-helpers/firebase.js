module.exports = {
  /**
   * Create a Firebase database stub resolving provided data snapshot
   * @param  {Object} config
   * @param  {Object} dataSnapshot
   * @param  {Object} childConf
   * @return {Object} - configuration for `Object.defineProperty()`
   */
  createDatabaseStub(config = {}, dataSnapshot = {}, childConf = {}) {
    const childWrapper = Object.assign({
      child: () => childWrapper,
      orderByChild: () => childWrapper,
      equalTo: () => childWrapper,
      once: () => Promise.resolve(dataSnapshot),
      remove: () => Promise.resolve(true),
      set: () => Promise.resolve(),
      update: () => Promise.resolve()
    }, childConf);

    return Object.assign({
      writable: true,
      value: () => ({ ref: () => childWrapper })
    }, config);
  },

  /**
   * Create a Firebase messaging stub with a provided API
   * @param  {Object} config
   * @param  {Object} api
   * @return {Object} - configuration for `Object.defineProperty()`
   */
  createMessagingStub(config = {}, api = {}) {
    return Object.assign({
      writable: true,
      value: () => api
    }, config)
  }
};
