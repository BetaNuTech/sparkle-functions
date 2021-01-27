const uuid = require('./uuid');

module.exports = {
  createFirestore() {
    return {
      collection: () => {},
      batch: () => ({
        commit: () => Promise.resolve(),
      }),
    };
  },

  /**
   * Create a snapshot of a
   * payload or a group of payloads
   * @param  {Object|Array}
   * @param  {String} id
   * @return {Object} - snapshot lookalike
   */
  wrapSnapshot(payload = {}, id) {
    const forEach = fn => {
      return Object.keys(payload).forEach(plId =>
        fn(this.wrapSnapshot(payload[plId], plId))
      );
    };

    const result = {};

    if (Array.isArray(payload)) {
      result.size = payload.length;
      result.docs = payload.map(pl => this.wrapSnapshot(pl, pl.id));
      result.forEach = forEach;
    } else {
      result.id = id || payload.id || uuid();
      result.exists = Boolean(payload);
      result.data = () => payload;
    }

    return result;
  },

  createSnapshot(id = uuid(), data = null) {
    return {
      exists: Boolean(data),
      id,
      data: () => data,
    };
  },

  createCollection(...docs) {
    return {
      docs,
      size: docs.length,
    };
  },

  createPubSub(cb = () => {}) {
    return {
      topic: () => ({
        publisher: () => ({
          publish: (...args) => {
            cb(...args);
            return Promise.resolve();
          },
        }),
      }),
    };
  },

  createPubSubHandler(msg) {
    return {
      topic: () => ({
        onPublish: handler => handler(msg),
      }),
    };
  },

  createMessagingStub(cb = () => {}) {
    return {
      sendToDevice(...args) {
        const result = cb(...args);
        return result || Promise.resolve({ multicastId: uuid() });
      },
    };
  },
};
